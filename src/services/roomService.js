/**
 * 多人聚餐房间服务 - Firebase Realtime Database 版本
 * 支持跨设备协同：
 * - 房主创建房间，生成带 roomId 的分享链接
 * - 受邀者打开链接，填写自己的成员信息后"提交"
 * - 房主端实时监听所有已提交成员，合并后进入推荐
 * - 如 Firebase 未配置，则降级为 localStorage 本地模式（仅同设备可用）
 */

import { database } from '../firebaseConfig';
import { ref, set, get, onValue, off, push, remove } from 'firebase/database';

const ROOM_PREFIX = 'eatwithme_room_';
const SELF_FLAG = '_self_submitted';

/**
 * 检查 Firebase 是否可用
 */
function isFirebaseAvailable() {
  return database !== null;
}

/**
 * 生成随机房间 ID
 */
function generateRoomId() {
  return Math.random().toString(36).slice(2, 8);
}

/**
 * 生成受邀者唯一 memberId
 */
export function generateMemberId() {
  return 'm_' + Math.random().toString(36).slice(2, 10);
}

/**
 * 创建房间，返回 roomId
 */
export async function createRoom() {
  const roomId = generateRoomId();

  if (isFirebaseAvailable()) {
    // Firebase 模式
    try {
      const roomRef = ref(database, `rooms/${roomId}`);
      await set(roomRef, {
        members: [],
        createdAt: Date.now(),
        status: 'active'
      });
      return roomId;
    } catch (error) {
      console.error('Firebase 创建房间失败:', error);
      // 降级到 localStorage
    }
  }

  // localStorage 模式（降级）
  localStorage.setItem(ROOM_PREFIX + roomId, JSON.stringify({ members: [], createdAt: Date.now() }));
  return roomId;
}

/**
 * 读取房间内所有成员（不含房主自己填的那份）
 * @param {string} roomId 房间 ID
 * @returns {Promise<Array>} 成员列表
 */
export async function getRoomMembers(roomId) {
  if (isFirebaseAvailable()) {
    try {
      const membersRef = ref(database, `rooms/${roomId}/members`);
      const snapshot = await get(membersRef);
      if (snapshot.exists()) {
        const data = snapshot.val();
        return Object.values(data);
      }
      return [];
    } catch (error) {
      console.error('Firebase 读取成员失败:', error);
      return [];
    }
  }

  // localStorage 模式（降级）
  try {
    const data = localStorage.getItem(ROOM_PREFIX + roomId);
    if (!data) return [];
    const parsed = JSON.parse(data);
    return parsed.members || [];
  } catch {
    return [];
  }
}

/**
 * 实时监听房间成员变化（用于房主端实时同步）
 * @param {string} roomId 房间 ID
 * @param {Function} callback 成员变化时的回调函数
 * @returns {Function} 取消监听函数
 */
export function subscribeRoomMembers(roomId, callback) {
  if (!isFirebaseAvailable()) {
    // Firebase 不可用时，使用轮询降级方案
    const intervalId = setInterval(async () => {
      const members = await getRoomMembers(roomId);
      callback(members);
    }, 2000);

    return () => clearInterval(intervalId);
  }

  // Firebase 实时监听
  const membersRef = ref(database, `rooms/${roomId}/members`);

  const unsubscribe = onValue(membersRef, (snapshot) => {
    if (snapshot.exists()) {
      const data = snapshot.val();
      const members = Object.values(data);
      callback(members);
    } else {
      callback([]);
    }
  }, (error) => {
    console.error('Firebase 监听失败:', error);
    callback([]);
  });

  return () => {
    off(membersRef);
  };
}

/**
 * 受邀者提交自己的成员信息到房间
 * @param {string} roomId 房间 ID
 * @param {Object} member 成员信息 { name, text, memberId }
 * @returns {Promise<boolean>} 是否提交成功
 */
export async function submitMemberToRoom(roomId, member) {
  if (isFirebaseAvailable()) {
    try {
      const membersRef = ref(database, `rooms/${roomId}/members`);
      // 使用 push 生成唯一键，避免冲突
      const newMemberRef = push(membersRef);
      await set(newMemberRef, {
        ...member,
        submittedAt: Date.now()
      });
      return true;
    } catch (error) {
      console.error('Firebase 提交成员失败:', error);
      return false;
    }
  }

  // localStorage 模式（降级）
  try {
    const data = localStorage.getItem(ROOM_PREFIX + roomId);
    const parsed = data ? JSON.parse(data) : { members: [], createdAt: Date.now() };
    const existing = parsed.members || [];

    // 用 memberId 去重（同一受邀者重复提交则覆盖）
    const idx = existing.findIndex(m => m.memberId === member.memberId);
    if (idx >= 0) existing[idx] = member;
    else existing.push(member);

    parsed.members = existing;
    localStorage.setItem(ROOM_PREFIX + roomId, JSON.stringify(parsed));
    return true;
  } catch {
    return false;
  }
}

/**
 * 房主标记自己已提交
 */
export async function markSelfSubmitted(roomId) {
  try {
    if (isFirebaseAvailable()) {
      const flagRef = ref(database, `rooms/${roomId}/selfSubmitted`);
      await set(flagRef, true);
    } else {
      localStorage.setItem(ROOM_PREFIX + roomId + SELF_FLAG, '1');
    }
  } catch (error) {
    console.error('标记已提交失败:', error);
  }
}

/**
 * 检查自己是否已提交
 */
export async function isSelfSubmitted(roomId) {
  try {
    if (isFirebaseAvailable()) {
      const flagRef = ref(database, `rooms/${roomId}/selfSubmitted`);
      const snapshot = await get(flagRef);
      return snapshot.exists() && snapshot.val() === true;
    } else {
      return localStorage.getItem(ROOM_PREFIX + roomId + SELF_FLAG) === '1';
    }
  } catch {
    return false;
  }
}

/**
 * 生成分享链接
 */
export function buildShareUrl(roomId) {
  const base = window.location.origin + window.location.pathname;
  return `${base}?room=${roomId}&join=1`;
}

/**
 * 解析当前 URL 是否为受邀加入
 */
export function parseJoinFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const roomId = params.get('room');
  const join = params.get('join');
  if (roomId && join === '1') return { roomId, isJoin: true };
  return { roomId: null, isJoin: false };
}

/**
 * 清理房间（房主端用）
 */
export async function clearRoom(roomId) {
  try {
    if (isFirebaseAvailable()) {
      const roomRef = ref(database, `rooms/${roomId}`);
      await remove(roomRef);
    } else {
      localStorage.removeItem(ROOM_PREFIX + roomId);
      localStorage.removeItem(ROOM_PREFIX + roomId + SELF_FLAG);
    }
  } catch (error) {
    console.error('清理房间失败:', error);
  }
}

/**
 * 检查房间是否存在
 */
export async function checkRoomExists(roomId) {
  try {
    if (isFirebaseAvailable()) {
      const roomRef = ref(database, `rooms/${roomId}`);
      const snapshot = await get(roomRef);
      return snapshot.exists();
    } else {
      return localStorage.getItem(ROOM_PREFIX + roomId) !== null;
    }
  } catch {
    return false;
  }
}
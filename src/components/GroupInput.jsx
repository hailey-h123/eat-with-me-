import { useState, useEffect, useCallback } from 'react';
import { IconSparkle, IconSearch, IconPlus, IconTrash2, IconUser, IconLoader2, IconShare2, IconLink, IconCheck, IconRefreshCw, IconUsers } from './icons/FancyIcons';
import { savePreference } from '../services/preferenceService';
import {
  createRoom, getRoomMembers, submitMemberToRoom, buildShareUrl,
  parseJoinFromUrl, markSelfSubmitted, isSelfSubmitted, generateMemberId, clearRoom,
  subscribeRoomMembers
} from '../services/roomService';
import LoadingOverlay from './LoadingOverlay';
import { useTranslation } from '../i18n';

export default function GroupInput({ onSearch, onRandomExplore, isLoading }) {
  const { t } = useTranslation();
  const getMemberPlaceholder = (index) => t(`group.placeholder${(index % 8) + 1}`);
  const [members, setMembers] = useState([
    { id: 1, name: '成员1', text: '' },
    { id: 2, name: '成员2', text: '' },
  ]);
  const [nextId, setNextId] = useState(3);

  // 协同房间相关状态
  const [roomState, setRoomState] = useState({ mode: 'local', roomId: null, isHost: false });
  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [joinMembers, setJoinMembers] = useState([]); // 受邀者提交的成员
  const [submitted, setSubmitted] = useState(false); // 受邀者是否已提交
  const [selfMemberId] = useState(() => generateMemberId()); // 受邀者唯一ID
  const [isCreatingRoom, setIsCreatingRoom] = useState(false); // 创建房间加载状态

  // 初始化：判断是否为受邀加入
  useEffect(() => {
    const initJoin = async () => {
      const { roomId, isJoin } = parseJoinFromUrl();
      if (isJoin && roomId) {
        setRoomState({ mode: 'join', roomId, isHost: false });
        // 受邀者默认填自己一个，名字框留空提示填真名，提交时自动编号
        setMembers([{ id: 1, name: '', text: '' }]);
        setNextId(2);
        const existing = await getRoomMembers(roomId);
        setJoinMembers(existing);
        const hasSubmitted = await isSelfSubmitted(roomId);
        setSubmitted(hasSubmitted);
      }
    };
    initJoin();
  }, []);

  // 房主端：实时监听受邀者提交的成员
  useEffect(() => {
    if (roomState.mode !== 'host' || !roomState.roomId) return;

    // 使用 Firebase 实时监听（或轮询降级）
    const unsubscribe = subscribeRoomMembers(roomState.roomId, (members) => {
      setJoinMembers(members);
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [roomState.mode, roomState.roomId]);

  const handleMemberChange = (id, field, value) => setMembers(members.map(m => m.id === id ? { ...m, [field]: value } : m));
  const handleAddMember = () => {
    if (members.length >= 8) return;
    setMembers([...members, { id: nextId, name: `成员${nextId}`, text: '' }]);
    setNextId(nextId + 1);
  };
  const handleRemoveMember = (id) => { if (members.length <= 1) return; setMembers(members.filter(m => m.id !== id)); };

  // 房主：创建房间并生成分享链接
  const handleCreateRoom = async () => {
    setIsCreatingRoom(true);
    try {
      const roomId = await createRoom();
      const url = buildShareUrl(roomId);
      setShareUrl(url);
      setRoomState({ mode: 'host', roomId, isHost: true });
      // 房主自己的成员编号从1开始（成员1、成员2...）
      setMembers(prev => prev.map((m, i) => ({ ...m, name: `成员${i + 1}` })));
      setNextId(prev => prev > members.length ? prev : members.length + 1);
    } catch (error) {
      console.error('创建房间失败:', error);
    } finally {
      setIsCreatingRoom(false);
    }
  };

  // 复制链接
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 降级：选中文本
    }
  };

  // 受邀者：提交自己的成员信息到房间
  const handleSubmitJoin = async () => {
    const valid = members.filter(m => m.text.trim());
    if (valid.length === 0) return;

    // 提交所有成员
    for (const m of valid) {
      await submitMemberToRoom(roomState.roomId, { name: '', text: m.text.trim(), memberId: selfMemberId });
    }
    await markSelfSubmitted(roomState.roomId);
    setSubmitted(true);
  };

  // 受邀者提交后想修改
  const handleEditJoin = async () => {
    await clearRoom(roomState.roomId);
    setSubmitted(false);
    setJoinMembers([]);
  };

  // 房主：合并自己 + 所有受邀者提交的成员，统一重新编号后进入推荐
  const handleHostSearch = (e) => {
    if (e) e.preventDefault();
    const myValid = members.filter(m => m.text.trim());
    const allMembers = [...myValid, ...joinMembers];
    if (allMembers.length === 0) return;
    // 匿名模式：统一重新编号为 成员1、成员2...
    const numbered = allMembers.map((m, i) => ({ ...m, name: `成员${i + 1}` }));
    savePreference(numbered, 'group');
    onSearch(numbered);
  };

  // 原始本地多人模式（无协同）
  const handleLocalSubmit = (e) => {
    e.preventDefault();
    const validMembers = members.filter(m => m.text.trim());
    if (validMembers.length === 0) return;
    // 本地模式也统一编号
    const numbered = validMembers.map((m, i) => ({ ...m, name: `成员${i + 1}` }));
    savePreference(numbered, 'group');
    onSearch(numbered);
  };

  const handleRandomExplore = () => {
    let allMembers = members.filter(m => m.text.trim());
    if (roomState.mode === 'host') allMembers = [...allMembers, ...joinMembers];
    // 匿名模式：统一重新编号
    const numbered = allMembers.map((m, i) => ({ ...m, name: `成员${i + 1}` }));
    onRandomExplore('fresh', numbered);
  };

  const hasAnyInput = members.some(m => m.text.trim());

  // ===== 受邀加入模式 =====
  if (roomState.mode === 'join') {
    return (
      <div className="max-w-2xl mx-auto px-6">
        <div className="fancy-card p-5 mb-4 flex items-start gap-3 slide-up">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary flex-shrink-0">
            <IconUsers className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-text">{t('group.invited')}</p>
            <p className="text-xs text-text-secondary mt-1">{t('group.invitedDesc')}</p>
          </div>
        </div>

        {submitted ? (
          <div className="fancy-card p-8 text-center slide-up">
            <div className="w-14 h-14 rounded-full bg-secondary/10 text-secondary flex items-center justify-center mx-auto mb-4">
              <IconCheck className="w-7 h-7" />
            </div>
            <p className="text-lg font-bold text-text mb-2">{t('group.submitted')}</p>
            <p className="text-sm text-text-secondary mb-5">{t('group.synced')}</p>
            <button type="button" onClick={handleEditJoin}
              className="btn-secondary px-5 py-2.5 text-sm flex items-center gap-2 mx-auto">
              <IconRefreshCw className="w-4 h-4" /> {t('group.editMy')}
            </button>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); handleSubmitJoin(); }}>
            <div className="space-y-3">
              {members.map((member, index) => (
                <div key={member.id} className="slide-up" style={{ animationDelay: `${index * 60}ms`, animationFillMode: 'both' }}>
                  <div className="fancy-card p-5 flex items-start gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary flex-shrink-0">
                      <IconUser className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-text mb-1.5">成员{index + 1}</p>
                      <textarea
                        value={member.text}
                        onChange={(e) => handleMemberChange(member.id, 'text', e.target.value)}
                        className="w-full h-[64px] bg-bg-soft text-sm text-text placeholder:text-text-muted resize-none focus:outline-none leading-relaxed rounded-xl px-3 py-2 border border-border/50 focus:border-primary/30 focus:ring-2 focus:ring-primary/10 transition-all"
                        placeholder={getMemberPlaceholder(index)}
                      />
                    </div>
                    {members.length > 1 && (
                      <button type="button" onClick={() => handleRemoveMember(member.id)}
                        className="p-1.5 text-text-muted hover:text-error rounded-xl transition-all duration-200 flex-shrink-0 mt-0.5" title={t('group.deleteMember')}>
                        <IconTrash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <button type="button" onClick={handleAddMember}
              disabled={isLoading || members.length >= 8}
              className="btn-secondary w-full mt-3 py-3 text-text-secondary disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              <IconPlus className="w-4 h-4" />
              {t('group.addMember')} {members.length >= 8 && t('group.maxMembers')}
            </button>

            <button type="submit" disabled={isLoading || !hasAnyInput}
              className="btn-primary w-full mt-6 py-3.5 text-base disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {isLoading ? (
                <span className="flex items-center gap-2"><IconLoader2 className="w-5 h-5 animate-spin" /> {t('group.submitting')}</span>
              ) : (
                <span className="flex items-center gap-2"><IconCheck className="w-5 h-5" /> {t('group.submit')}</span>
              )}
            </button>
          </form>
        )}
      </div>
    );
  }

  // ===== 房主协同模式 =====
  if (roomState.mode === 'host') {
    return (
      <div className="max-w-2xl mx-auto px-6">
        {/* 分享链接卡片 */}
        <div className="fancy-card p-5 mb-4 slide-up">
          <div className="flex items-center gap-2 mb-3">
            <IconShare2 className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-text">{t('group.shareLink')}</span>
          </div>
          <div className="flex gap-2">
            <div className="flex-1 bg-bg-soft rounded-xl px-3 py-2.5 border border-border/50 flex items-center min-w-0">
              <IconLink className="w-4 h-4 text-text-muted flex-shrink-0 mr-2" />
              <input type="text" readOnly value={shareUrl}
                className="flex-1 bg-transparent text-xs text-text-secondary focus:outline-none min-w-0 truncate" />
            </div>
            <button type="button" onClick={handleCopyLink}
              className="btn-primary px-4 py-2.5 text-sm flex items-center gap-1.5 flex-shrink-0">
              {copied ? <><IconCheck className="w-4 h-4" /> {t('group.copied')}</> : t('group.copy')}
            </button>
          </div>
          <p className="text-xs text-text-muted mt-2">{t('group.shareHint')}</p>
        </div>

        {/* 已加入的成员 */}
        {joinMembers.length > 0 && (
          <div className="mb-4 slide-up">
            <p className="text-xs text-text-secondary mb-2 font-medium flex items-center gap-1.5">
              <IconUsers className="w-3.5 h-3.5" /> {t('group.received', { count: joinMembers.length })}
            </p>
            <div className="space-y-2">
              {joinMembers.map((m, i) => (
                <div key={i} className="fancy-card p-4 flex items-start gap-3 slide-up" style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'both' }}>
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-secondary/10 text-secondary flex-shrink-0">
                    <IconCheck className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">{m.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 房主自己填写 */}
        <form onSubmit={handleHostSearch}>
          <p className="text-xs text-text-secondary mb-2 font-medium">{t('group.myEntry')}</p>
          <div className="space-y-3">
            {members.map((member, index) => (
              <div key={member.id} className="slide-up" style={{ animationDelay: `${index * 60}ms`, animationFillMode: 'both' }}>
                <div className="fancy-card p-5 flex items-start gap-3">
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary flex-shrink-0">
                    <IconUser className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-text mb-1.5">成员{index + 1}</p>
                    <textarea
                      value={member.text}
                      onChange={(e) => handleMemberChange(member.id, 'text', e.target.value)}
                      className="w-full h-[64px] bg-bg-soft text-sm text-text placeholder:text-text-muted resize-none focus:outline-none leading-relaxed rounded-xl px-3 py-2 border border-border/50 focus:border-primary/30 focus:ring-2 focus:ring-primary/10 transition-all"
                      placeholder={getMemberPlaceholder(index)}
                    />
                  </div>
                  {members.length > 1 && (
                    <button type="button" onClick={() => handleRemoveMember(member.id)}
                      className="p-1.5 text-text-muted hover:text-error rounded-xl transition-all duration-200 flex-shrink-0 mt-0.5" title={t('group.deleteMember')}>
                      <IconTrash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button type="button" onClick={handleAddMember}
            disabled={isLoading || members.length >= 8}
            className="btn-secondary w-full mt-3 py-3 text-text-secondary disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            <IconPlus className="w-4 h-4" />
            {t('group.addMember')} {members.length >= 8 && t('group.maxMembers')}
          </button>

          <div className="flex gap-3 mt-6">
            <button type="submit" disabled={isLoading || !hasAnyInput}
              className="btn-primary flex-1 py-3.5 text-base disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {isLoading ? (
                <span className="flex items-center gap-2"><IconLoader2 className="w-5 h-5 animate-spin" /> {t('group.thinking')}</span>
              ) : (
                <span className="flex items-center gap-2"><IconSearch className="w-5 h-5" /> {t('group.helpUs')}</span>
              )}
            </button>
            <button type="button" onClick={handleRandomExplore} disabled={isLoading || !hasAnyInput}
              className="btn-secondary px-6 py-3.5 text-primary text-base disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              <IconSparkle className="w-5 h-5" />
              {t('group.tryNew')}
            </button>
          </div>
        </form>
      </div>
    );
  }

  // ===== 默认本地模式 =====
  return (
    <div className="max-w-2xl mx-auto px-6">
      <form onSubmit={handleLocalSubmit}>
        <div className="space-y-3">
          {members.map((member, index) => (
            <div key={member.id} className="slide-up" style={{ animationDelay: `${index * 60}ms`, animationFillMode: 'both' }}>
              <div className="fancy-card p-5 flex items-start gap-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary flex-shrink-0">
                  <IconUser className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-text mb-1.5">成员{index + 1}</p>
                  <textarea
                    value={member.text}
                    onChange={(e) => handleMemberChange(member.id, 'text', e.target.value)}
                    className="w-full h-[64px] bg-bg-soft text-sm text-text placeholder:text-text-muted resize-none focus:outline-none leading-relaxed rounded-xl px-3 py-2 border border-border/50 focus:border-primary/30 focus:ring-2 focus:ring-primary/10 transition-all"
                    placeholder={getMemberPlaceholder(index)}
                    />
                  </div>
                  {members.length > 1 && (
                    <button type="button" onClick={() => handleRemoveMember(member.id)}
                      className="p-1.5 text-text-muted hover:text-error rounded-xl transition-all duration-200 flex-shrink-0 mt-0.5" title={t('group.deleteMember')}>
                      <IconTrash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button type="button" onClick={handleAddMember}
            disabled={isLoading || members.length >= 8}
            className="btn-secondary w-full mt-3 py-3 text-text-secondary disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            <IconPlus className="w-4 h-4" />
            {t('group.addMember')} {members.length >= 8 && t('group.maxMembers')}
          </button>

          {/* 邀请好友入口 */}
          <button type="button" onClick={handleCreateRoom} disabled={isCreatingRoom}
            className="btn-secondary w-full mt-3 py-3 text-primary flex items-center justify-center gap-2 disabled:opacity-50">
            {isCreatingRoom ? (
              <><IconLoader2 className="w-4 h-4 animate-spin" /> {t('group.creating')}</>
            ) : (
              <><IconShare2 className="w-4 h-4" /> {t('group.invite')}</>
            )}
          </button>

          <div className="flex gap-3 mt-6">
            <button type="submit" disabled={isLoading || !hasAnyInput}
              className="btn-primary flex-1 py-3.5 text-base disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              {isLoading ? (
                <span className="flex items-center gap-2"><IconLoader2 className="w-5 h-5 animate-spin" /> {t('group.thinking')}</span>
              ) : (
                <span className="flex items-center gap-2"><IconSearch className="w-5 h-5" /> {t('group.helpUs')}</span>
              )}
            </button>
            <button type="button" onClick={handleRandomExplore} disabled={isLoading || !hasAnyInput}
              className="btn-secondary px-6 py-3.5 text-primary text-base disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
              <IconSparkle className="w-5 h-5" />
              {t('group.tryNew')}
            </button>
          </div>

          <p className="text-xs text-text-muted text-center mt-5">
            {t('group.aiHint')}
          </p>
      </form>

      {isLoading && <LoadingOverlay />}
    </div>
  );
}
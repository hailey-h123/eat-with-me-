/**
 * 用户画像服务（纯前端本地统计，无后端）
 * - 等级计算（决定次数）
 * - 口味偏好标签（收藏/去过/搜索历史推导）
 * - 成就徽章解锁判断
 */

// ============ 等级 ============

const LEVEL_TABLE = [
  { level: 1, title: '新手', min: 0, max: 4 },
  { level: 2, title: '食客', min: 5, max: 9 },
  { level: 3, title: '品鉴官', min: 10, max: 19 },
  { level: 4, title: '老饕', min: 20, max: Infinity },
];

/**
 * 根据决定次数计算等级
 * @returns {{ level:number, title:string, progress:number, nextThreshold:number, current:number, levelMin:number }}
 *   progress: 0-1 当前等级内进度；Lv.4 满级时为 1
 */
export function computeLevel(decisionCount) {
  const count = Number.isFinite(decisionCount) && decisionCount > 0 ? decisionCount : 0;
  const entry = LEVEL_TABLE.find(l => count >= l.min && count <= l.max) || LEVEL_TABLE[0];
  const isMax = !Number.isFinite(entry.max);
  const span = isMax ? 1 : (entry.max - entry.min + 1);
  const progress = isMax ? 1 : Math.min(1, (count - entry.min) / span);
  const nextThreshold = isMax ? entry.min : (entry.max + 1);
  return {
    level: entry.level,
    title: entry.title,
    progress,
    nextThreshold,
    current: count,
    levelMin: entry.min,
    isMax,
  };
}

// ============ 口味偏好标签 ============

/** 收藏+去过的菜系频次表，降序 */
function cuisineFrequency(favorites, visited) {
  const freq = {};
  [...favorites, ...visited].forEach(r => {
    const cuisine = r?.cuisine;
    if (cuisine && typeof cuisine === 'string') {
      freq[cuisine] = (freq[cuisine] || 0) + 1;
    }
  });
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .map(([cuisine, count]) => ({ cuisine, count }));
}

/** 中位数 */
function median(nums) {
  if (!nums.length) return 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * 计算口味偏好标签（规则见产品文档 5.3）
 * @param {Array} favorites 收藏列表（historyService.getFavorites()）
 * @param {Array} visited 去过列表（historyService.getVisited()）
 * @param {Array} searchHistory 搜索历史（含扩展字段 allergies/distRange）
 * @returns {Array<{label:string, type:string}>} 标签数组
 */
export function computeTasteTags(favorites = [], visited = [], searchHistory = []) {
  const tags = [];
  const total = favorites.length + visited.length;
  if (total === 0) return tags;

  // 1. 常吃 XX：频次 Top1-2 且占比 ≥ 25%
  const freq = cuisineFrequency(favorites, visited);
  freq.slice(0, 2).forEach(({ cuisine, count }) => {
    if (count / total >= 0.25) {
      tags.push({ label: `常吃${cuisine}`, type: 'cuisine' });
    }
  });

  // 2. 人均 XXX：最近 10 家去过餐厅价格中位数分档
  const recentPrices = visited.slice(0, 10).map(r => r?.price).filter(p => typeof p === 'number' && p > 0);
  if (recentPrices.length > 0) {
    const med = median(recentPrices);
    let label;
    if (med < 50) label = '人均50以下';
    else if (med < 100) label = '人均50-100';
    else if (med < 200) label = '人均100-200';
    else label = '人均200+';
    tags.push({ label, type: 'price' });
  }

  // 3. 忌口 XX：所有搜索历史 allergies 并集
  const allergySet = new Set();
  searchHistory.forEach(h => (h?.allergies || []).forEach(a => a && allergySet.add(a)));
  allergySet.forEach(a => tags.push({ label: `忌口${a}`, type: 'allergy' }));

  // 4. 步行可达优先：distRange 近距（maxKm ≤ 1）出现频次 > 50%
  const withDist = searchHistory.filter(h => Array.isArray(h?.distRange));
  if (withDist.length > 0) {
    const nearCount = withDist.filter(h => (h.distRange[1] || 0) <= 1).length;
    if (nearCount / withDist.length > 0.5) {
      tags.push({ label: '步行可达优先', type: 'distance' });
    }
  }

  // 5. 偶尔吃 XX：频次第 3-4 名且占比 10%-25%
  freq.slice(2, 4).forEach(({ cuisine, count }) => {
    const ratio = count / total;
    if (ratio >= 0.10 && ratio < 0.25) {
      tags.push({ label: `偶尔吃${cuisine}`, type: 'cuisine' });
    }
  });

  return tags;
}

// ============ 成就徽章 ============

const SPICY_CUISINES = ['川菜', '湘菜', '贵州菜', '江西菜', '云南菜'];

const BADGE_DEFS = [
  { id: 'decade', icon: '🎯', label: '十连决', desc: '累计决定过 10 次' },
  { id: 'spicy', icon: '🌶️', label: '辣星人', desc: '辣系菜占比 ≥ 40%' },
  { id: 'organizer', icon: '👥', label: '组局王', desc: '多人模式决定 ≥ 5 次' },
  { id: 'solo', icon: '🥢', label: '独行侠', desc: '单人模式决定 ≥ 10 次' },
];

/**
 * 计算成就徽章
 * @param {Object} opts { favorites, visited, decisionCount, groupCount, soloCount }
 *   groupCount/soloCount 来自搜索历史的 mode 统计（group / solo 类）
 * @returns {Array<{id,icon,label,desc,unlocked}>}
 */
export function computeBadges({ favorites = [], visited = [], decisionCount = 0, groupCount = 0, soloCount = 0 } = {}) {
  const pool = [...favorites, ...visited];
  const spicyCount = pool.filter(r => SPICY_CUISINES.includes(r?.cuisine)).length;

  const unlockedMap = {
    decade: decisionCount >= 10,
    spicy: pool.length > 0 && spicyCount / pool.length >= 0.40,
    organizer: groupCount >= 5,
    solo: soloCount >= 10,
  };

  return BADGE_DEFS.map(def => ({ ...def, unlocked: !!unlockedMap[def.id] }));
}

/** 从搜索历史统计多人/单人决定次数（供徽章用） */
export function countModes(searchHistory = []) {
  let group = 0;
  let solo = 0;
  searchHistory.forEach(h => {
    if (h?.mode === 'group') group++;
    else solo++;
  });
  return { groupCount: group, soloCount: solo };
}

// ============ 头像 ============

const AVATAR_POOL = ['😊', '😋', '🤩', '🍜', '🌶️', '🍣'];
const AVATAR_KEY = 'eatwithme_avatar';

/** 取头像 emoji；首次调用时随机固定一个存 localStorage，避免刷新变化 */
export function getAvatar() {
  try {
    let avatar = localStorage.getItem(AVATAR_KEY);
    if (!avatar) {
      avatar = AVATAR_POOL[Math.floor(Math.random() * AVATAR_POOL.length)];
      localStorage.setItem(AVATAR_KEY, avatar);
    }
    return avatar;
  } catch {
    return AVATAR_POOL[0];
  }
}

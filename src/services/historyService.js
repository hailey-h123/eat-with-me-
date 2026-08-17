const HISTORY_KEY = 'eatwithme_search_history';
const FAVORITES_KEY = 'eatwithme_favorites';
const VISITED_KEY = 'eatwithme_visited';
const DECISION_COUNT_KEY = 'eatwithme_decision_count';

const MAX_HISTORY = 20;
const MAX_FAVORITES = 100;
const MAX_VISITED = 100;

// ============ 搜索历史 ============

export function getSearchHistory() {
  try {
    const data = localStorage.getItem(HISTORY_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function addSearchHistory(entry) {
  try {
    const history = getSearchHistory();
    const newEntry = {
      id: Date.now(),
      // allergies / distRange 供口味标签统计（忌口并集、步行可达频次），可选
      allergies: entry.allergies || [],
      distRange: entry.distRange || null,
      ...entry,
      timestamp: Date.now(),
    };
    // 去重：相同文本+模式只保留最新
    const filtered = history.filter(h =>
      !(h.text === entry.text && h.mode === entry.mode)
    );
    filtered.unshift(newEntry);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered.slice(0, MAX_HISTORY)));
  } catch {}
}

export function clearSearchHistory() {
  try { localStorage.removeItem(HISTORY_KEY); } catch {}
}

// ============ 收藏 ============

export function getFavorites() {
  try {
    const data = localStorage.getItem(FAVORITES_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function isFavorited(id) {
  return getFavorites().some(r => r.id === id);
}

export function toggleFavorite(restaurant) {
  try {
    const favorites = getFavorites();
    const idx = favorites.findIndex(r => r.id === restaurant.id);
    if (idx >= 0) {
      favorites.splice(idx, 1);
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
      return false;
    } else {
      favorites.unshift({
        id: restaurant.id,
        name: restaurant.name,
        cuisine: restaurant.cuisine || '',
        price: restaurant.price || 0,
        rating: restaurant.rating || 0,
        address: restaurant.address || '',
        tags: restaurant.tags || [],
        photos: (restaurant.photos || []).slice(0, 1),
        timestamp: Date.now(),
      });
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites.slice(0, MAX_FAVORITES)));
      return true;
    }
  } catch { return false; }
}

// ============ 去过 ============

export function getVisited() {
  try {
    const data = localStorage.getItem(VISITED_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function isVisited(id) {
  return getVisited().some(r => r.id === id);
}

export function toggleVisited(restaurant) {
  try {
    const visited = getVisited();
    const idx = visited.findIndex(r => r.id === restaurant.id);
    if (idx >= 0) {
      visited.splice(idx, 1);
      localStorage.setItem(VISITED_KEY, JSON.stringify(visited));
      return false;
    } else {
      visited.unshift({
        id: restaurant.id,
        name: restaurant.name,
        cuisine: restaurant.cuisine || '',
        price: restaurant.price || 0,
        rating: restaurant.rating || 0,
        address: restaurant.address || '',
        tags: restaurant.tags || [],
        photos: (restaurant.photos || []).slice(0, 1),
        timestamp: Date.now(),
        mood: null, // 用户后续在足迹页选感受：great / ok / bad
      });
      localStorage.setItem(VISITED_KEY, JSON.stringify(visited.slice(0, MAX_VISITED)));
      return true;
    }
  } catch { return false; }
}

// 记录/更新去过感受（😋 great / 🙂 ok / 😐 bad）
export function setVisitedMood(id, mood) {
  try {
    const visited = getVisited();
    const item = visited.find(r => r.id === id);
    if (!item) return false;
    // 再点一次同一表情 = 取消
    item.mood = (item.mood === mood) ? null : mood;
    localStorage.setItem(VISITED_KEY, JSON.stringify(visited));
    return item.mood;
  } catch { return false; }
}

// ============ 决定次数 ============

// 每次成功生成推荐结果（单人/多人/探索/占卜/投票/feed 详情点击）+1
export function incrementDecisionCount() {
  try {
    const count = getDecisionCount() + 1;
    localStorage.setItem(DECISION_COUNT_KEY, String(count));
    return count;
  } catch { return 0; }
}

export function getDecisionCount() {
  try {
    const raw = localStorage.getItem(DECISION_COUNT_KEY);
    const count = parseInt(raw, 10);
    return Number.isFinite(count) && count > 0 ? count : 0;
  } catch { return 0; }
}

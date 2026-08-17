/**
 * 推荐服务（主入口）
 * 包含: 单人模式配置、群体推荐主流程、recommendByMode 调度
 */
import { mockRestaurants } from '../data/mockRestaurants';
import { CUISINE_KEYWORDS_FOR_FILTER } from '../data/cuisineMap';
import { searchPOI, searchPOIByCategory, haversineDistance } from './amapService';
import { applyFeedbackToScore, makeProfileFingerprint } from './feedbackService';
import {
  countSafeSignals,
  calculateSoloFriendly,
  calculateGroupScore,
  calculateSingleScore,
  filterByAllergies,
  getCuisineSearchKeys,
  getFusionSearchKeywords,
  getBridgeFusionMarkers,
  CUISINE_SYNONYMS,
  getExpandedSearchKeyword,
  filterExpansionsByAllergies,
  mmrRerank,
} from './scoringService';
import { exploreHiddenTreasures, randomExplore, getExploreModes } from './exploreService';
import { FORTUNE_CARDS, drawFortuneCard, recommendFortune } from './fortuneService';

// 重新导出，保持外部引用兼容
export {
  calculateSoloFriendly,
  calculateGroupScore,
  calculateMemberScore,
  calculateScore,
  filterByAllergies,
  analyzeEmptyResult,
  getTimeSlot,
} from './scoringService';
export { randomExplore, getExploreModes } from './exploreService';
export { FORTUNE_CARDS, drawFortuneCard } from './fortuneService';

// ============ 常量配置 ============

/** 最终返回给前端的最大推荐结果数 */
const MAX_RESULTS = 5;
/** tier 分差守卫（保留供后续使用） */
const TIER_SCORE_GAP = 5;
/** 价格过滤后候选不足阈值，触发补充搜索 */
const MIN_CANDIDATES_AFTER_PRICE = 5;

function isPriceInRange(price, minP, maxP) {
  if (price == null || price <= 0 || isNaN(price)) return true;
  // 只有 maxP === null 才表示"无上限"；显式上限（如「300以内」）必须真实过滤
  const noCap = (maxP === null);
  return noCap ? price >= minP : (price >= minP && price <= maxP);
}

// ============ 单人模式配置 ============

export const SOLO_MODES = {
  TIRED: 'tired',
  LIGHT: 'light',
  INDULGE: 'indulge',
  COLD: 'cold',
  EXPLORE_NEAR: 'explore_near',
  EXPLORE_MID: 'explore_mid',
  EXPLORE_FAR: 'explore_far',
  EXPLORE_ANY: 'explore_any',
  FORTUNE: 'fortune',
};

export function getSoloModes() {
  return {
    [SOLO_MODES.TIRED]: {
      label: '加班好累',
      icon: '😮‍💨',
      category: 'scenario',
      description: '搜索距离最近的快餐/面馆，优先上菜快',
    },
    [SOLO_MODES.LIGHT]: {
      label: '想轻食',
      icon: '🥗',
      category: 'scenario',
      description: '搜索沙拉/轻食/健康餐，低卡优先',
    },
    [SOLO_MODES.INDULGE]: {
      label: '想放纵',
      icon: '🍔',
      category: 'scenario',
      description: '搜索烤肉/汉堡/重口味，高热量优先',
    },
    [SOLO_MODES.COLD]: {
      label: '天冷冷的',
      icon: '🍲',
      category: 'scenario',
      description: '搜索火锅/汤面/砂锅，热乎的优先',
    },
    [SOLO_MODES.EXPLORE_NEAR]: {
      label: '附近宝藏',
      icon: '🏠',
      category: 'explore',
      description: '1km 内的隐藏好店',
      searchRadius: 1000,
    },
    [SOLO_MODES.EXPLORE_MID]: {
      label: '走远一点',
      icon: '🚶',
      category: 'explore',
      description: '3km 内的惊喜发现',
      searchRadius: 3000,
    },
    [SOLO_MODES.EXPLORE_FAR]: {
      label: '骑车去探',
      icon: '🚲',
      category: 'explore',
      description: '5km 内的宝藏店',
      searchRadius: 5000,
    },
    [SOLO_MODES.EXPLORE_ANY]: {
      label: '不限距离',
      icon: '🚀',
      category: 'explore',
      description: '全城搜索，最值得去的店',
      searchRadius: 10000,
    },
    [SOLO_MODES.FORTUNE]: {
      label: '今日运势',
      icon: '🔮',
      category: 'fortune',
      description: '抽卡决定吃什么',
    },
  };
}

export function getSoloModeCategories() {
  return [
    {
      key: 'scenario',
      label: '按心情选',
      icon: '🎯',
      description: '根据当下的心情和状态',
      expandable: true,
    },
    {
      key: 'explore',
      label: '探索未知',
      icon: '🧭',
      description: '按距离搜索被埋没的宝藏店',
      expandable: true,
    },
    {
      key: 'fortune',
      label: '今日运势',
      icon: '🔮',
      description: '抽卡决定吃什么',
      expandable: true,
    },
  ];
}

function getModeIntent(mode) {
  switch (mode) {
    case SOLO_MODES.TIRED:
      return {
        preferences: ['快餐', '面馆'],
        maxDistance: 1000,
        searchKeyword: '快餐|面馆|米粉|饺子|包子|便当|盒饭|小吃',
      };
    case SOLO_MODES.LIGHT:
      return {
        preferences: ['沙拉', '轻食', '健康餐'],
        searchKeyword: '沙拉|轻食|健康餐|简餐|低卡餐|轻食餐厅|健身餐|超级碗|藜麦碗|波奇饭|poke|蔬果汁|冷压果汁|Brunch|早午餐|素食餐厅|低碳水|生酮',
        expandCategories: ['050200', '050201', '050202'],
      };
    case SOLO_MODES.INDULGE:
      return {
        preferences: ['烤肉', '汉堡', '烧烤'],
        searchKeyword: '烤肉|烧烤|汉堡|炸鸡|火锅|小龙虾|串串|烤鱼',
      };
    case SOLO_MODES.COLD:
      return {
        preferences: ['火锅', '汤面', '砂锅'],
        searchKeyword: '火锅|汤面|砂锅|麻辣烫|串串|涮肉|羊肉汤|牛肉汤',
      };
    case SOLO_MODES.EXPLORE_NEAR:
      return { maxDistance: 1000 };
    case SOLO_MODES.EXPLORE_MID:
      return { maxDistance: 3000 };
    case SOLO_MODES.EXPLORE_FAR:
      return { maxDistance: 5000 };
    case SOLO_MODES.EXPLORE_ANY:
      return {};
    default:
      return {};
  }
}

function getExploreRadius(mode) {
  const soloModes = getSoloModes();
  const modeConfig = soloModes[mode];
  return modeConfig?.searchRadius || 3000;
}

function buildSearchKeyword(intent) {
  if (intent.cuisineVote) {
    const { consensusLevel, topCuisine, tieCuisines } = intent.cuisineVote;

    if (consensusLevel === 'strong' && topCuisine) {
      return topCuisine;
    }

    if (consensusLevel === 'split' && tieCuisines && tieCuisines.length >= 2) {
      return `${tieCuisines[0]}|${tieCuisines[1]}`;
    }
  }

  if (intent.searchKeyword) {
    return intent.searchKeyword;
  }

  const keywords = [];

  if (intent.shopType) {
    keywords.push(intent.shopType);
  }

  if (intent.preferences && intent.preferences.length > 0) {
    keywords.push(...intent.preferences.filter(p =>
      !['减肥', '安静', '热闹', '环境好', '实惠', '清淡', '热乎', '重口味', '下饭', '暖和', '甜的', '甜食', '随便', '随便吃点', '快', '慢', '环境好', '便宜', '贵', '高档', '好吃', '正宗', 'light', 'heavy', 'warm', 'cheap', 'expensive', 'fancy', 'quiet', 'lively', 'spicy', 'sweet'].includes(p)
    ));
  }

  if (keywords.length === 0) {
    keywords.push('餐厅');
  }

  return keywords.join('|');
}

// ============ 群体推荐主流程 ============

/**
 * 根据 intent.distRange 推导搜索半径（米）
 * distRange 来自成员距离偏好（如"近一点"→[0,1]km）
 * 无 distRange 时默认 3000m
 */
export function getSearchRadiusFromIntent(intent) {
  if (intent && intent.distRange && Array.isArray(intent.distRange) && intent.distRange.length >= 2) {
    const maxKm = intent.distRange[1];
    if (maxKm <= 1) return 1000;
    if (maxKm <= 2) return 2000;
    if (maxKm <= 3) return 3000;
    if (maxKm <= 5) return 5000;
    return 8000;
  }
  return 3000;
}

/**
 * 群体推荐
 */
export async function recommendRestaurants(intent, location, excludeIds = []) {
  let candidates = [];
  const expandedSeenIds = new Set();

  // 搜索半径动态化：优先用 intent.distRange 推导，否则默认 3000m
  let searchRadius = getSearchRadiusFromIntent(intent);

  // 多人模式：如果成员有独立位置，搜索中心点改为成员质心，搜索半径扩大以覆盖所有成员
  let searchCenter = location;
  const memberLocations = (intent.members || [])
    .map(m => m.memberLocation)
    .filter(ml => ml && ml.lat && ml.lng);
  if (memberLocations.length > 0) {
    // 计算质心（经纬度平均值）
    const avgLat = memberLocations.reduce((s, ml) => s + ml.lat, 0) / memberLocations.length;
    const avgLng = memberLocations.reduce((s, ml) => s + ml.lng, 0) / memberLocations.length;
    searchCenter = { name: '成员中心点', lat: avgLat, lng: avgLng };
    // 扩大搜索半径：质心到最远成员的距离 + 原始半径
    const maxMemberDist = Math.max(...memberLocations.map(ml =>
      haversineDistance(avgLng, avgLat, ml.lng, ml.lat)
    ));
    searchRadius = Math.max(searchRadius, maxMemberDist + 1000);
  }

  const cuisineKeys = getCuisineSearchKeys(intent);

  // 真正的空偏好快路径：所有成员"随便"且无过敏时，直接搜"餐厅"跳过融合/冲突/相关性的空分支
  // 后续 allergy / minRating / price / distance / 评分 自然执行；多菜系/冲突/相关性分支因守卫被跳过
  if (cuisineKeys.length === 0 && (!intent.allergies || intent.allergies.length === 0)) {
    if (searchCenter) {
      const direct = await searchPOI('餐厅', searchCenter, searchRadius);
      if (direct && direct.length > 0) {
        candidates = direct.filter(r => !excludeIds.includes(r.id));
        direct.forEach(r => expandedSeenIds.add(r.id));
      } else {
        candidates = [...mockRestaurants].filter(r => !excludeIds.includes(r.id));
      }
    } else {
      candidates = [...mockRestaurants].filter(r => !excludeIds.includes(r.id));
    }
  }

  if (searchCenter && cuisineKeys.length >= 2) {
    // 多菜系：用扩展关键词分别搜索每个菜系，追踪每个餐厅命中了哪些菜系
    // 扩展关键词解决烤涮一体等跨菜系餐厅因标签不匹配搜不到的问题
    // 例如：搜索"烤肉|烧烤|韩式烤肉|日式烤肉|烧肉"代替仅搜"烤肉"
    const candidateCuisines = new Map(); // id -> Set<cuisineKey>

    // 并行搜索所有菜系（串行会成倍增加首屏延迟）
    const cuisineSearchTasks = cuisineKeys.map(async (key) => {
      try {
        let searchKeyword = getExpandedSearchKeyword(key);
        if (intent.allergies) searchKeyword = filterExpansionsByAllergies(searchKeyword, intent.allergies);
        if (!searchKeyword) return []; // 过敏过滤后为空
        const results = await searchPOI(searchKeyword, searchCenter, searchRadius);
        if (!results || results.length === 0) return [];
        // 按名字匹配度排序：名字直接包含菜系同义词（如"涮肉""烧烤"）的排前面
        // 高德 API 返回顺序按距离/热度，名字含关键词的店不一定排前，直接 slice 会丢掉
        const synonyms = CUISINE_SYNONYMS[key] || [key];
        const sorted = [...results].sort((a, b) => {
          const aMatch = synonyms.some(s => (a.name || '').includes(s)) ? 1 : 0;
          const bMatch = synonyms.some(s => (b.name || '').includes(s)) ? 1 : 0;
          return bMatch - aMatch;
        });
        return sorted.slice(0, 25);
      } catch (e) {
        return [];
      }
    });
    // 串行搜索各菜系，配合全局节流器避免 QPS 雪崩
    const cuisineSearchResults = [];
    for (const task of cuisineSearchTasks) {
      cuisineSearchResults.push(await task);
    }
    cuisineKeys.forEach((key, idx) => {
      const results = cuisineSearchResults[idx];
      results.forEach(r => {
        if (excludeIds.includes(r.id)) return;
        if (!expandedSeenIds.has(r.id)) {
          expandedSeenIds.add(r.id);
          candidates.push(r);
          candidateCuisines.set(r.id, new Set([key]));
        } else {
          candidateCuisines.get(r.id)?.add(key);
        }
      });
    });

    // 融合候选：同时命中多个菜系搜索的餐厅 → 天然跨菜系
    const fusionIds = new Set();
    for (const [id, keys] of candidateCuisines) {
      if (keys.size >= 2) fusionIds.add(id);
    }

    // 补充搜索：用菜系组合词扩大候选池（如"火锅烧烤"比"烤涮一体"更真实），扩大搜索半径
    // 并行搜索所有融合关键词
    const fusionKeywords = getFusionSearchKeywords(intent);
    const fusionSearchTasks = fusionKeywords.map(async (fusionKey) => {
      try {
        // 🔧 修复：融合关键词也做过敏感知过滤
        let safeKeyword = fusionKey;
        if (intent.allergies) safeKeyword = filterExpansionsByAllergies(safeKeyword, intent.allergies);
        if (!safeKeyword) return { fusionKey, results: [] }; // 过滤后为空则跳过该融合词
        const results = await searchPOI(safeKeyword, searchCenter, Math.max(searchRadius * 2, 5000));
        return { fusionKey, results: (results && results.length > 0) ? results.slice(0, 25) : [] };
      } catch (e) {
        return { fusionKey, results: [] };
      }
    });
    const fusionSearchResults = await Promise.all(fusionSearchTasks);
    fusionSearchResults.forEach(({ fusionKey, results }) => {
      results.forEach(r => {
        if (!expandedSeenIds.has(r.id) && !excludeIds.includes(r.id)) {
          expandedSeenIds.add(r.id);
          candidates.push({ ...r, _fusionKeyword: fusionKey });
          fusionIds.add(r.id);
        }
      });
    });

    // 需求桥接搜索：需求×菜系（如辣×韩餐），搜出的店打 _fusionPrefs 标记进融合桶
    const bridgeMarkers = getBridgeFusionMarkers(intent);
    const bridgeResults = await Promise.all(bridgeMarkers.map(async ({ keyword, prefs }) => {
      try {
        let safeKeyword = keyword;
        if (intent.allergies) safeKeyword = filterExpansionsByAllergies(safeKeyword, intent.allergies);
        if (!safeKeyword) return { keyword, prefs, results: [] };
        const results = await searchPOI(safeKeyword, searchCenter, Math.max(searchRadius * 2, 5000));
        return { keyword, prefs, results: (results && results.length > 0) ? results.slice(0, 25) : [] };
      } catch (e) {
        return { keyword, prefs, results: [] };
      }
    }));
    bridgeResults.forEach(({ keyword, prefs, results }) => {
      results.forEach(r => {
        if (!expandedSeenIds.has(r.id) && !excludeIds.includes(r.id)) {
          expandedSeenIds.add(r.id);
          candidates.push({ ...r, _fusionKeyword: keyword, _fusionPrefs: prefs });
          fusionIds.add(r.id);
        }
      });
    });

    // 将融合候选排到最前面
    if (fusionIds.size > 0) {
      const fusionCandidates = candidates.filter(c => fusionIds.has(c.id));
      const otherCandidates = candidates.filter(c => !fusionIds.has(c.id));
      candidates = [...fusionCandidates, ...otherCandidates];
    }
  }

  // 单菜系、或分别搜索无结果时，回退到合并搜索
  if (candidates.length === 0) {
    // 用扩展关键词搜索，避免单关键词搜偏（如"川菜"搜出全是火锅）
    let searchKeyword;
    if (cuisineKeys.length === 1) {
      searchKeyword = getExpandedSearchKeyword(cuisineKeys[0]);
      if (intent.allergies) searchKeyword = filterExpansionsByAllergies(searchKeyword, intent.allergies);
    } else {
      searchKeyword = buildSearchKeyword(intent);
      // 🔧 修复：兜底 buildSearchKeyword 如果含明确菜系关键词，也做过敏过滤
      if (intent.allergies && intent.preferences && intent.preferences.length > 0) {
        searchKeyword = filterExpansionsByAllergies(searchKeyword, intent.allergies);
      }
    }
    // 如果过滤后为空（偏好菜系完全与过敏冲突），直接走通用餐厅兜底
    let realRestaurants = null;
    if (searchKeyword && searchCenter) {
      realRestaurants = await searchPOI(searchKeyword, searchCenter, searchRadius);
    }

    if (realRestaurants && realRestaurants.length > 0) {
      candidates = realRestaurants.filter(r => !excludeIds.includes(r.id));
    } else if (searchCenter) {
      // 兜底：用通用"餐厅"搜索
      const fallbackResults = await searchPOI('餐厅', searchCenter, searchRadius);
      if (fallbackResults && fallbackResults.length > 0) {
        candidates = fallbackResults.filter(r => !excludeIds.includes(r.id));
      } else {
        candidates = [...mockRestaurants].filter(r => !excludeIds.includes(r.id));
      }
    } else {
      candidates = [...mockRestaurants].filter(r => !excludeIds.includes(r.id));
    }
  }

  // ========== 两步搜索策略：有 expandCategories 配置（如 LIGHT 轻食模式）时，候选不足追加类别搜索 ==========
  const TWO_STEP_MIN_CANDIDATES = 8; // 低于此数量触发类别补充搜索
  if (intent.expandCategories && intent.expandCategories.length > 0 && searchCenter && candidates.length < TWO_STEP_MIN_CANDIDATES) {
    try {
      // 注意：类别搜索半径稍大（5km），确保能捞到"超级碗"等店名不含轻食关键词的正经轻食店
      const categoryRadius = Math.max(searchRadius, 5000);
      const categoryResults = await searchPOIByCategory(intent.expandCategories, searchCenter, categoryRadius, 1, 25);
      if (categoryResults && categoryResults.length > 0) {
        // 构建偏好关键词合集（CUISINE_KEYWORDS 偏好同义词 + 搜索关键词），用于类别搜索结果的软门槛
        const preferenceKeywords = new Set();
        (intent.preferences || []).forEach(p => {
          preferenceKeywords.add(p);
          (CUISINE_KEYWORDS[p] || []).forEach(kw => preferenceKeywords.add(kw));
        });
        if (intent.searchKeyword) {
          intent.searchKeyword.split('|').forEach(kw => { if (kw) preferenceKeywords.add(kw); });
        }
        const kwArr = Array.from(preferenceKeywords);
        const existingIds = new Set(candidates.map(r => r.id));
        const newCandidates = categoryResults.filter(r => {
          if (excludeIds.includes(r.id) || existingIds.has(r.id) || expandedSeenIds.has(r.id)) return false;
          // 类别搜索软门槛：名字/tags/features/featureTags 里至少命中 1 个偏好关键词，杜绝外国餐厅大类下的无关餐厅（如日料/韩餐纯正餐）
          const haystack = [r.name || '', ...(r.tags || []), ...(r.features || []), ...(r.featureTags || [])].join(' ');
          return kwArr.some(kw => kw && haystack.includes(kw));
        });
        // 标记为 _fromCategorySearch，后续相关性验证时会跳过菜系同义词强过滤（因为类别搜索来的店店名可能不含轻食关键词）
        newCandidates.forEach(r => {
          r._fromCategorySearch = true;
          expandedSeenIds.add(r.id);
        });
        candidates.push(...newCandidates);
      }
    } catch (e) {
      console.warn('[recommendRestaurants] 两步搜索-类别补充失败，跳过:', e?.message);
    }
  }

  // 如果有软冲突，额外搜索替代关键词补充候选
  if (intent.conflictAltKeywords && intent.conflictAltKeywords.length > 0 && searchCenter) {
    for (const altKeyword of intent.conflictAltKeywords) {
      try {
        // 🔧 修复：冲突替代关键词也做过敏感知过滤
        let safeAlt = altKeyword;
        if (intent.allergies) safeAlt = filterExpansionsByAllergies(safeAlt, intent.allergies);
        if (!safeAlt) continue;
        const altResults = await searchPOI(safeAlt, searchCenter, searchRadius);
        if (altResults && altResults.length > 0) {
          altResults.forEach(r => {
            if (!expandedSeenIds.has(r.id) && !excludeIds.includes(r.id)) { expandedSeenIds.add(r.id); candidates.push(r); }
          });
        }
      } catch (e) {
        // 冲突补充搜索失败，跳过
      }
    }
  }

  // 硬约束过滤（一票否决）
  candidates = filterByAllergies(candidates, intent.allergies, intent.conflicts || []);

  // 搜索相关性验证：结合 cuisine + name + tags 判断是否为真正的目标品类
  {
    const allSearchTerms = cuisineKeys.flatMap(k => getExpandedSearchKeyword(k).split('|').filter(Boolean));
    if (allSearchTerms.length > 0) {
      candidates = candidates.filter(r => {
        // 类别搜索来的餐厅（如超级碗）店名可能不含关键词，跳过第一层强过滤，留到评分软排序
        if (r._fromCategorySearch) return true;
        // 融合店豁免：日韩料理/川湘菜等组合词店名不含单个菜系完整词，不能按菜系关键词硬过滤
        if (r._fusionKeyword) return true;
        const searchText = [
          r.cuisine || '',
          r.name || '',
          ...(r.tags || []),
          ...(r.features || []),
          ...(r.featureTags || []),
        ].join('');
        return allSearchTerms.some(term => searchText.includes(term));
      });
    }
    // 第二层：非融合搜索来的候选，需在 cuisine/name/tags 中匹配到菜系同义词
    // AMap 语义匹配可能返回无关餐厅（如搜"烧烤"→新疆菜），用同义词库兜底过滤
    const allCuisineSyns = new Set();
    cuisineKeys.forEach(k => {
      (CUISINE_SYNONYMS[k] || [k]).forEach(s => allCuisineSyns.add(s));
    });
    if (allCuisineSyns.size > 0) {
      candidates = candidates.filter(r => {
        // 融合关键词来的不过滤（如涮烤自助→伍棵煋）
        if (r._fusionKeyword) return true;
        // 类别搜索来的餐厅（如超级碗）也跳过同义词强过滤，交给评分软排序
        if (r._fromCategorySearch) return true;
        const searchText = [r.cuisine || '', r.name || '', ...(r.tags || [])].join('');
        return [...allCuisineSyns].some(syn => searchText.includes(syn));
      });
    }
    // 注意：不再做「过滤后为空就回退到验证前」的兜底。
    // 那会把「餐厅」兜底搜出的无关餐厅（西餐/本帮菜等）放回，污染结果。
    // 搜不到目标菜系时应保持为空，由 analyzeEmptyResult 给出建议。
  }

  const activeConflicts = intent.conflicts || [];
  const conflictAllergy = activeConflicts.length > 0 ? activeConflicts[0].allergy : null;

  // 菜系相关性过滤：有明确菜系偏好时，剔除完全无关的餐厅（咖啡/甜品/面包/沙拉等）
  // 只要过滤后不为空就保留过滤结果，只有过滤后完全为空才回退（防止沙拉咖啡硬挤上榜）
  const cuisinePrefs = (intent.preferences || []).filter(p =>
    Object.keys(CUISINE_KEYWORDS_FOR_FILTER).includes(p) ||
    Object.values(CUISINE_KEYWORDS_FOR_FILTER).some(arr => arr.includes(p))
  );
  const IRRELEVANT_CUISINES = ['咖啡', '奶茶', '甜品', '面包', '糕点', '烘焙', '茶艺', '酒吧', '冷饮', '轻食', '沙拉', '便利店', '零食', '超市', '小吃', '快餐外卖', '卤味', '熟食'];
  if (cuisinePrefs.length > 0) {
    const beforeFilter = [...candidates];
    candidates = candidates.filter(r => {
      const cuisine = (r.cuisine || '').trim();
      // 如果餐厅主菜系明确属于无关类别，且不在任何偏好菜系的语义范围内，则剔除
      if (IRRELEVANT_CUISINES.some(c => cuisine.includes(c))) {
        // 但如果餐厅 tags/features 里有匹配的偏好菜系关键词，保留
        const allFeatures = [...(r.tags || []), ...(r.features || [])].join('');
        return cuisinePrefs.some(pref => {
          const keywords = CUISINE_KEYWORDS_FOR_FILTER[pref];
          return keywords ? keywords.some(kw => allFeatures.includes(kw)) : allFeatures.includes(pref);
        });
      }
      return true;
    });
    // 🔧 修复：过滤后只有完全为空时才回退，哪怕只剩1个川菜也比沙拉强
    if (candidates.length === 0) candidates = beforeFilter;
  }

  // 最低评分过滤
  if (intent.minRating) {
    candidates = candidates.filter(r => {
      const rating = r.rating || 0;
      return rating >= intent.minRating;
    });
  }

  // 将个人 budget 和 minBudget 转为 priceRange，确保硬过滤生效
  // 🔧 修复：不原地修改 intent（否则 handleRefresh 复用 lastIntent 时，二次调用会跳过这个转换）
  let effectivePriceRange = intent.priceRange;
  if (!effectivePriceRange && (intent.budget || intent.minBudget)) {
    effectivePriceRange = [intent.minBudget || 0, intent.budget]; // null=无上限
  }

  // 价格范围过滤（在评分前过滤）
  // 🔧 重要修复：price 缺失/0/NaN 的餐厅不得硬剔除——高德 POI 价格覆盖率低，否则预算场景下直接全空
  //    与 recommendByMode.applyPrefFilter 保持一致：当作"价格未知，保留由评分软约束"
  //    只把明确已知超出预算的剔除
  if (effectivePriceRange) {
    const [minP, maxP] = effectivePriceRange;
    candidates = candidates.filter(r => isPriceInRange(r.price, minP, maxP));

    // 候选不足时，扩大搜索范围
    if (candidates.length < MIN_CANDIDATES_AFTER_PRICE && searchCenter) {
      let keyword = buildSearchKeyword(intent);
      // 🔧 修复：价格补充搜索的关键词也做过敏感知过滤
      if (intent.allergies && intent.preferences && intent.preferences.length > 0) {
        keyword = filterExpansionsByAllergies(keyword, intent.allergies);
      }
      let page2 = null;
      if (keyword) page2 = await searchPOI(keyword, searchCenter, 5000, 0, 0, 2);
      if (page2 && page2.length > 0) {
        const newOnes = page2.filter(r => !excludeIds.includes(r.id) && !candidates.some(c => c.id === r.id));
        const filtered = newOnes.filter(r => isPriceInRange(r.price, minP, maxP));
        candidates.push(...filtered);
      }
      // 仍然不足，用通用"餐厅"搜索 + 更大半径
      if (candidates.length < MIN_CANDIDATES_AFTER_PRICE) {
        const broad = await searchPOI('餐厅', searchCenter, 5000);
        if (broad && broad.length > 0) {
          const newOnes = broad.filter(r => !excludeIds.includes(r.id) && !candidates.some(c => c.id === r.id));
          const filtered = newOnes.filter(r => isPriceInRange(r.price, minP, maxP))
          candidates.push(...filtered);
        }
      }
    }
  }

  // 距离范围过滤
  if (intent.distRange) {
    const [minKm, maxKm] = intent.distRange;
    const minMin = minKm * 12;
    const maxMin = maxKm >= 5 ? Infinity : maxKm * 12;
    candidates = candidates.filter(r => {
      const dist = r.distance || 0;
      return dist >= minMin && dist <= maxMin;
    });
  }

  // 冲突关联菜系扩张：搜能化解冲突的关联菜系（火锅/湘菜/云贵等），补齐候选多样性
  // 原始菜系（川菜）标记 _isExpanded=false，关联菜系标记 _isExpanded=true
  // 评分时：关联菜系 +8，原始菜系没信号 -8，让火锅/湘菜/云贵压过没证据的川菜
  const needsExpand = activeConflicts.length > 0 && candidates.length > 0 && searchCenter;

  if (needsExpand) {
    candidates.forEach(r => { expandedSeenIds.add(r.id); r._isExpanded = false; });

    async function expandWith(keyword, radius, isExpanded = true, useCompactTerms = true) {
      try {
        // 扩张搜索默认用 maxTerms=2，减少 API 调用；初始搜索和原桶重搜按需选择 3
        const maxTermsForExpand = useCompactTerms ? 2 : 3;
        const results = await searchPOI(keyword, searchCenter, radius, 0, 0, 1, 25, maxTermsForExpand);
        if (!results || results.length === 0) return;
        let batch = results.filter(r => !excludeIds.includes(r.id) && !expandedSeenIds.has(r.id));
        if (batch.length === 0) return;
        batch = filterByAllergies(batch, intent.allergies, intent.conflicts || []);
        // 相关性验证：结合 cuisine + name + tags 综合判断
        // 对4字以上关键词做宽松匹配：拆分为2字子词，命中任一即通过
        // 如"韩式烤肉"→["韩式","式烤","烤肉"]，餐厅有"烤肉"或"韩式"即通过
        {
          const terms = keyword.split('|').filter(Boolean);
          // filterExpansionsByAllergies 追加的修饰前缀（如"不辣湘菜"）
          // 这些前缀是通用安全信号，拆分会误放所有标"不辣"的无关餐厅（西餐/本帮菜等）
          // 处理方式：去掉前缀后只对核心菜系词做完整匹配，不做子词拆分
          const MODIFIER_PREFIXES = ['不辣', '改良', '新派', '日式', '泰式', '韩式'];
          if (terms.length > 0) {
            batch = batch.filter(r => {
              const searchText = [r.cuisine || '', r.name || '', ...(r.tags || []), ...(r.features || []), ...(r.featureTags || [])].join('');
              return terms.some(t => {
                if (searchText.includes(t)) return true;
                // 修饰前缀词（如"不辣湘菜"→"湘菜"）：只做核心词完整匹配
                const modPrefix = MODIFIER_PREFIXES.find(p => t.startsWith(p) && t.length > p.length);
                if (modPrefix) {
                  return searchText.includes(t.slice(modPrefix.length));
                }
                // 多字关键词拆分2字子词做宽松匹配
                if (t.length >= 4) {
                  for (let i = 0; i <= t.length - 2; i++) {
                    if (searchText.includes(t.substring(i, i + 2))) return true;
                  }
                }
                return false;
              });
            });
          }
        }
        if (cuisinePrefs.length > 0) {
          batch = batch.filter(r => {
            const cuisine = (r.cuisine || '').trim();
            if (IRRELEVANT_CUISINES.some(c => cuisine.includes(c))) {
              const allFeatures = [...(r.tags || []), ...(r.features || [])].join('');
              return cuisinePrefs.some(pref => {
                const keywords = CUISINE_KEYWORDS_FOR_FILTER[pref];
                return keywords ? keywords.some(kw => allFeatures.includes(kw)) : allFeatures.includes(pref);
              });
            }
            return true;
          });
        }
        if (effectivePriceRange) {
          const [minP, maxP] = effectivePriceRange;
          batch = batch.filter(r => {
            return isPriceInRange(r.price, minP, maxP);
          });
        }
        const fresh = batch.slice(0, MAX_RESULTS);
        fresh.forEach(r => { r._isExpanded = isExpanded; expandedSeenIds.add(r.id); });
        candidates.push(...fresh);
      } catch (e) {
        // QPS 超限等 API 错误不中断整个推荐流程
      }
    }

    const expandRadius = Math.max(searchRadius * 2, 5000);

    // 分批并行：高德免费版 QPS≈5，每批最多 3 个并发 + 批间 300ms 间隔，避免 10021 超限
    // maxCuisines：限制扩张菜系数量，列表定义顺序即优先级（门店密度/化解能力从高到低）
    async function expandBatch(keywords, isExpanded = true, useCompactTerms = true, maxCuisines = 4) {
      const BATCH_SIZE = 3;
      const BATCH_DELAY = 300;
      const limitedKeywords = keywords.slice(0, maxCuisines);
      const expandedKeywords = limitedKeywords
        .map(kw => getExpandedSearchKeyword(kw))
        .map(kw => intent.allergies ? filterExpansionsByAllergies(kw, intent.allergies) : kw)
        .filter(Boolean);
      for (let i = 0; i < expandedKeywords.length; i += BATCH_SIZE) {
        const batch = expandedKeywords.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(kw => expandWith(kw, expandRadius, isExpanded, useCompactTerms)));
        if (i + BATCH_SIZE < expandedKeywords.length) {
          await new Promise(resolve => setTimeout(resolve, BATCH_DELAY));
        }
      }
    }

    // 通用框架：按"品类自化解能力"判断是否需要跨菜系扩张
    // 自化解 = 偏好本身就能化解冲突（如火锅→鸳鸯锅、烤肉→有蔬菜可烤）
    // 自化解品类只扩半径搜自己，不跨菜系；其余按各冲突类型的扩张规则走
    const pref = activeConflicts[0]?.preference || '';
    const SELF_RESOLVING = {
      '辣': new Set(['火锅', '串串', '麻辣烫', '冒菜']),
      '素食': new Set(['火锅', '烤肉', '烧烤']),
      '海鲜': new Set(['火锅', '东北菜', '北京菜', '鲁菜', '西北菜', '川菜', '湘菜', '韩餐', '西餐', '贵州菜', '江西菜', '云南菜', '新疆菜']),
      '减肥': new Set(['轻食', '沙拉', '日料', '健康餐', '素食']),
      '低卡': new Set(['轻食', '沙拉', '日料', '健康餐', '素食']),
    };
    // 按用户偏好菜系映射的扩张表：只有偏好菜系与忌口硬冲突时才扩张相似菜系
    // key = conflictAllergy, value = { 偏好菜系: [相似菜系列表] }
    // 菜系忌口（cuisine_avoid）：同圈扩张 + 同菜系非典型形态扩张
    // SPICY_CIRCLE：圈组内完整关联，用于"贵州菜→湘菜/川菜/云南菜"等场景的菜系映射
    // 注意：5 个菜系都保留，但高频 pref（川菜）的扩张顺序和数量通过 SPICY_EXPLICIT_LIMIT 单独控制
    const SPICY_CIRCLE = ['川菜', '湘菜', '贵州菜', '江西菜', '云南菜'];
    // 川菜+不吃辣的高频场景：限制扩张的顺序和数量，减少 API 调用
    // 门店密度从高到低：湘菜 > 云南菜 > 火锅（必加，鸳鸯锅化解力最强）
    // 贵州菜和江西菜门店少，跳过；如果后续发现用户高频搜贵州菜，再调大 EXPLICIT_LIMIT
    const SPICY_EXPLICIT_LIMIT = {
      '川菜': ['湘菜', '云南菜', '火锅'],
      '四川菜': ['湘菜', '云南菜', '火锅'],
      '重庆菜': ['湘菜', '云南菜', '火锅'],
      // 其他 pref 不设限，按 SPICY_CIRCLE 完整扩张
    };
    const LIGHT_CIRCLE = ['粤菜', '江浙菜', '客家菜', '福建菜'];
    const BBQ_CIRCLE = ['烧烤', '烤肉', '烤串', '铁板烧', '韩式烤肉', '日式烧肉'];
    const HOTPOT_CIRCLE = ['烤涮一体', '麻辣烫', '串串', '冒菜'];
    // 生成"圈组内互相扩张"配置：忌口 X → 扩张圈内其他 X
    function buildCircleExpansion(circle) {
      const result = {};
      circle.forEach(x => {
        result[x] = circle.filter(y => y !== x);
      });
      return result;
    }
    // 辣系扩张：先按圈组内互替，再根据 EXPLICIT_LIMIT 覆盖高频 pref 的扩张列表
    // 火锅=鸳鸯锅是「不吃辣」的最强化解方案，所有辣系 pref 默认追加火锅（除非 EXPLICIT_LIMIT 已指定）
    const spicyExpansion = buildCircleExpansion(SPICY_CIRCLE);
    SPICY_CIRCLE.forEach(x => {
      if (SPICY_EXPLICIT_LIMIT[x]) {
        spicyExpansion[x] = SPICY_EXPLICIT_LIMIT[x]; // 覆盖：用显式列表
      } else {
        spicyExpansion[x] = [...spicyExpansion[x], '火锅']; // 默认：圈内互替 + 火锅
      }
    });
    const EXPANSION_MAP = {
      // ============ 原有硬冲突类型（辣/素食/海鲜/减肥）============
      '辣': {
        ...spicyExpansion,
      },
      '素食': {
        '烧烤': ['火锅', '川菜', '云南菜'],
        '烤肉': ['火锅', '川菜', '云南菜'],
        '牛排': ['火锅', '川菜', '云南菜'],
      },
      '海鲜': {
        '日料': ['韩餐'],
        '粤菜': ['客家菜'],
        '海鲜': ['川菜', '湘菜', '火锅', '烧烤'],
      },
      '减肥': {
        ...Object.fromEntries(['川菜', '湘菜'].map(x => [x, ['云南菜', '粤菜', '江浙菜', '日料']])),
        '烧烤': ['日料', '轻食', '沙拉', '东南亚菜', '云南菜'],
        '烤肉': ['日料', '轻食', '沙拉', '东南亚菜', '云南菜'],
      },
      '低卡': {
        ...Object.fromEntries(['川菜', '湘菜'].map(x => [x, ['云南菜', '粤菜', '江浙菜', '日料']])),
        '烧烤': ['日料', '轻食', '沙拉', '东南亚菜', '云南菜'],
        '烤肉': ['日料', '轻食', '沙拉', '东南亚菜', '云南菜'],
      },
      // ============ 菜系忌口类型（cuisine_avoid）============
      // 韩餐：扩张同菜系非典型形态（烤肉/炸鸡/拌饭等，忌口汤饭但不忌口烤肉）
      '韩餐': {
        '韩餐': ['韩式烤肉', '韩式炸鸡', '韩式烤串', '日式烧肉', '韩式石锅拌饭'],
        '韩国料理': ['韩式烤肉', '韩式炸鸡', '韩式烤串', '日式烧肉', '韩式石锅拌饭'],
      },
      // 日料：扩张非刺身形态（烧肉/烤串/寿喜烧/拉面/定食/炸猪排等，忌口刺身但不忌口烤肉）
      '日料': {
        '日料': ['日式烧肉', '韩式烤肉', '寿喜烧', '日式烤串', '铁板烧', '日式拉面', '日式定食', '日式炸猪排'],
        '日本料理': ['日式烧肉', '韩式烤肉', '寿喜烧', '日式烤串', '铁板烧', '日式拉面', '日式定食', '日式炸猪排'],
      },
      // 烧烤/烤肉：烧烤圈组内互相扩张（去掉火锅，按你要求）
      ...Object.fromEntries(BBQ_CIRCLE.map(x => [x, buildCircleExpansion(BBQ_CIRCLE)[x]])),
      // 火锅：火锅圈组内扩张
      '火锅': { '火锅': HOTPOT_CIRCLE },
      '麻辣烫': { '麻辣烫': HOTPOT_CIRCLE.filter(x => x !== '麻辣烫') },
      '串串': { '串串': HOTPOT_CIRCLE.filter(x => x !== '串串') },
      '冒菜': { '冒菜': HOTPOT_CIRCLE.filter(x => x !== '冒菜') },
      // 辣系圈：忌口川/湘/贵/赣/云/客家 → 圈组内扩张其他菜系
      ...Object.fromEntries(SPICY_CIRCLE.map(x => [x, buildCircleExpansion(SPICY_CIRCLE)[x]])),
      // 清淡圈：忌口粤/江浙/客家/福建 → 圈组内扩张其他菜系
      ...Object.fromEntries(LIGHT_CIRCLE.map(x => [x, buildCircleExpansion(LIGHT_CIRCLE)[x]])),
    };

    const selfSet = SELF_RESOLVING[conflictAllergy];
    // 原桶重搜只有在 expandRadius > searchRadius 且当前 pref 餐厅不足时才触发
    // 初始搜索已经用相同关键词 + searchRadius 搜过，大部分候选已在 expandedSeenIds 里
    const MIN_PREF_RESTAURANTS = 3;
    const prefSynonyms = new Set([pref, ...(CUISINE_SYNONYMS[pref] || [])]);
    const currentPrefCount = candidates.filter(r => {
      const text = [r.cuisine || '', r.name || '', ...(r.tags || []), ...(r.features || [])].join('');
      return [...prefSynonyms].some(s => text.includes(s));
    }).length;
    const needPrefExpand = expandRadius > searchRadius && currentPrefCount < MIN_PREF_RESTAURANTS;

    if (selfSet && selfSet.has(pref)) {
      // 自化解品类：只扩半径搜自己（子品类通过 getExpandedSearchKeyword 自然覆盖）
      if (needPrefExpand) {
        await expandBatch([pref], false, true); // 最后一个参数 maxTerms=2
      }
    } else if (EXPANSION_MAP[conflictAllergy]) {
      // 偏好菜系扩大半径重搜（保持 _isExpanded=false，归入原桶）
      if (needPrefExpand) {
        await expandBatch([pref], false, true);
      }
      // 跨菜系扩张（_isExpanded=true，归入扩展桶）
      // 按用户偏好菜系查映射表，找不到匹配的偏好则不扩张（不是硬冲突）
      const expansionConfig = EXPANSION_MAP[conflictAllergy];
      const expandList = expansionConfig[pref];
      if (expandList) {
        await expandBatch(expandList, true, true);
      }
    }
  }

  // 群体评分
  const feedbackFingerprint = makeProfileFingerprint({
    preferences: intent.preferences || [],
    allergies: intent.allergies || [],
    budget: intent.budget || null,
  });
  const scoredRestaurants = candidates.map(restaurant => {
    const { score, reasons, _groupMin, _groupAvg, solutionTier, compromiseDetails, memberScores, _matchedPrefs } = calculateGroupScore(restaurant, intent);
    let adjustedScore = applyFeedbackToScore(restaurant, score, feedbackFingerprint);

    return {
      ...restaurant,
      matchScore: adjustedScore,
      reasons,
      soloFriendly: calculateSoloFriendly(restaurant),
      _groupMin,
      _groupAvg,
      solutionTier: solutionTier || 3,
      compromiseDetails: compromiseDetails || [],
      memberScores: memberScores || [],
      _matchedPrefs: _matchedPrefs || [],
    };
  });

  // ===== 分层精排：MMR + tier + 分差守卫，每层独立跑 =====
  // 有冲突时：原始菜系（_isExpanded=false）和关联菜系（_isExpanded=true）各自跑 MMR+tier
  // 然后拼接：原始 Top 2 + 关联 Top 3，正好 5 家
  const getScore = (r) => (typeof r.matchScore === 'number' && !isNaN(r.matchScore)) ? r.matchScore : 0;
  const SATISFIED_THRESHOLD = 60;
  const satisfiedCount = (r) => {
    if (!r.memberScores || r.memberScores.length === 0) return 0;
    return r.memberScores.filter(ms => (ms.score ?? ms.overall ?? 0) >= SATISFIED_THRESHOLD).length;
  };

  function applyTierRanking(group, topN) {
    if (group.length <= 1) return group.slice(0, topN);

    // MMR 多样性重排
    let ranked = mmrRerank(group, intent);

    // tier 分桶
    const tierBuckets = new Map();
    ranked.forEach(r => {
      const t = r.solutionTier ?? 3;
      if (!tierBuckets.has(t)) tierBuckets.set(t, []);
      tierBuckets.get(t).push(r);
    });
    const tiers = [...tierBuckets.keys()].sort();

    let top1 = null;
    if (tiers.length >= 1) {
      const chosen = [];
      const used = new Set();
      top1 = [...ranked].sort((a, b) => getScore(b) - getScore(a))[0];
      chosen.push(top1);
      used.add(top1.id);

      // 分差守卫：tier最高分 < Top1 - 5，跳过
      const top1Score = getScore(top1);
      for (const t of tiers) {
        if (chosen.length >= Math.min(5, topN)) break;
        // 同 tier 内优先选有安全信号的餐厅（有"不辣""点心"等证据的优先于纯推断的）
        const bucket = tierBuckets.get(t).filter(r => !used.has(r.id));
        if (bucket.length === 0) continue;
        const pick = bucket.sort((a, b) => {
          const aSig = conflictAllergy ? countSafeSignals(a, conflictAllergy) : 0;
          const bSig = conflictAllergy ? countSafeSignals(b, conflictAllergy) : 0;
          if (aSig !== bSig) return bSig - aSig;
          return getScore(b) - getScore(a);
        })[0];
        if (getScore(pick) < top1Score - TIER_SCORE_GAP) continue;
        chosen.push(pick);
        used.add(pick.id);
      }
      // 不够补满
      for (const r of ranked) {
        if (chosen.length >= topN) break;
        if (!used.has(r.id)) { chosen.push(r); used.add(r.id); }
      }
      ranked = chosen;
    }

    // 最终排序：满意人数降序 → tier 升序 → score 降序
    // 满意人数优先：让所有人都满意的餐厅永远排在只满足一人的前面
    ranked.sort((a, b) => {
      const aSat = satisfiedCount(a);
      const bSat = satisfiedCount(b);
      if (aSat !== bSat) return bSat - aSat;
      const aT = a.solutionTier ?? 3;
      const bT = b.solutionTier ?? 3;
      if (aT !== bT) return aT - bT;
      return getScore(b) - getScore(a);
    });

    // 保位：Top1 必须在第 1 位
    if (top1 && ranked.length > 0) {
      const idx = ranked.findIndex(r => r.id === top1.id);
      if (idx > 0) {
        const [item] = ranked.splice(idx, 1);
        ranked.unshift(item);
      }
    }

    return ranked.slice(0, topN);
  }

  let balancedResults;
  if (needsExpand) {
    // 判断冲突类型：cuisine_avoid（菜系忌口） vs 其他（辣/海鲜/素食/减肥忌口）
    // - 辣/海鲜等忌口：原桶（如川菜）保 Top1（有不辣证据时 Tier1/2，没证据时 Tier3 但也给一个川菜位置）
    // - cuisine_avoid（韩餐/日料等忌口）：原桶（纯韩餐传统店）多为 Tier3 无化解能力，不保 Top1
    //   让 Tier2 的扩张餐厅（韩式烤肉/日式烧肉等同圈替代）自然排到 Tier3 传统店前面
    const hasCuisineAvoid = activeConflicts.some(c => c.type === 'cuisine_avoid');

    // 方案B：原桶保 Top1 川菜馆（tier 最高的），剩余位置全局按 tier 排序
    // 有冲突时，有不辣证据的餐厅（Tier 1/2）优先于无证据的川菜馆（Tier 3）
    const original = scoredRestaurants.filter(r => !r._isExpanded);
    const expanded = scoredRestaurants.filter(r => r._isExpanded);

    // 子品类去重：火锅系最多 2 个槽位，同子品类最多 1 个
    const HOTPOT_SUBTYPES = {
      '火锅': ['火锅', '涮锅', '涮肉', '铜锅', '打边炉', '锅物'],
      '麻辣烫': ['麻辣烫'],
      '串串': ['串串'],
      '冒菜': ['冒菜'],
    };
    const getHotpotSubtype = (r) => {
      const text = [r.cuisine || '', ...(r.tags || []), ...(r.features || [])].join('');
      for (const [sub, kws] of Object.entries(HOTPOT_SUBTYPES)) {
        if (kws.some(kw => text.includes(kw))) return sub;
      }
      return null;
    };
    const dedupeBySubtype = (list, topN, maxHotpot) => {
      const result = [];
      let hotpotCount = 0;
      const subtypeCounts = {};
      for (const r of list) {
        if (result.length >= topN) break;
        const subtype = getHotpotSubtype(r);
        if (subtype) {
          if (hotpotCount >= maxHotpot) continue;
          // 火锅（鸳鸯锅化解力最强）允许 2 个，其他火锅系子品类各 1 个
          const maxForSubtype = subtype === '火锅' ? 2 : 1;
          const cur = subtypeCounts[subtype] || 0;
          if (cur >= maxForSubtype) continue;
          subtypeCounts[subtype] = cur + 1;
          hotpotCount++;
        }
        result.push(r);
      }
      return result;
    };

    // 火锅优先于麻辣烫/串串/冒菜：同为辣系化解场景，火锅鸳鸯锅化解能力更强
    const HOTPOT_KW = ['火锅', '涮锅', '涮肉', '铜锅', '打边炉', '锅物'];
    const MALA_KW = ['麻辣烫', '串串', '冒菜'];
    const isHotpotType = (r) => HOTPOT_KW.some(k => [r.cuisine || '', ...(r.tags || []), ...(r.features || [])].join('').includes(k));
    const isMalaType = (r) => MALA_KW.some(k => [r.cuisine || '', ...(r.tags || []), ...(r.features || [])].join('').includes(k));

    // 全局排序：满意人数 → tier → 不辣证据 → 火锅优先 → matchScore
    const globalSort = (a, b) => {
      const aSat = satisfiedCount(a); const bSat = satisfiedCount(b);
      if (aSat !== bSat) return bSat - aSat;
      const aT = a.solutionTier ?? 3; const bT = b.solutionTier ?? 3;
      if (aT !== bT) return aT - bT;
      // 同 tier 内：不辣证据（清汤/白灼/粉蒸等 safeSignals）多的排前，让"不辣的店"优先
      const aSig = conflictAllergy ? countSafeSignals(a, conflictAllergy) : 0;
      const bSig = conflictAllergy ? countSafeSignals(b, conflictAllergy) : 0;
      if (aSig !== bSig) return bSig - aSig;
      // 同 tier 下火锅优先于麻辣烫
      const aH = isHotpotType(a), bH = isHotpotType(b);
      const aM = isMalaType(a), bM = isMalaType(b);
      if (aH && bM) return -1;
      if (bH && aM) return 1;
      return getScore(b) - getScore(a);
    };

    // Step 1: 原桶 Top1 策略
    // 只有原桶第一名 Tier<=2（有不辣证据/场景化解能力）才保位到第 1
    // 全是 tier3（无证据的辣川菜）时不保，让火锅等 tier2 扩张餐厅通过 globalSort 自然排前
    const originalMMR = mmrRerank([...original].sort(globalSort), intent);
    let topOriginal = [];
    if (originalMMR.length > 0 && (originalMMR[0].solutionTier ?? 3) <= 2) {
      topOriginal = [originalMMR[0]];
    }

    // Step 2: 剩余所有餐厅（原桶剩余 + 全部扩展桶）全局按 tier 排
    const remainingPoolStartIdx = topOriginal.length > 0 ? 1 : 0;
    const remaining = [
      ...originalMMR.slice(remainingPoolStartIdx),
      ...mmrRerank([...expanded].sort(globalSort), intent),
    ].sort(globalSort);

    // Step 3: 去重填充剩余位置
    const usedIds = new Set(topOriginal.map(r => r.id));
    const remainingRanked = dedupeBySubtype(remaining, MAX_RESULTS - topOriginal.length, 3);
    remainingRanked.forEach(r => usedIds.add(r.id));

    balancedResults = [...topOriginal, ...remainingRanked];

    // 不足补齐
    if (balancedResults.length < MAX_RESULTS) {
      for (const r of [...original, ...expanded].sort(globalSort)) {
        if (balancedResults.length >= MAX_RESULTS) break;
        if (!usedIds.has(r.id)) { balancedResults.push(r); usedIds.add(r.id); }
      }
    }
  } else {
    // 无冲突：检查是否为多偏好不同大类场景（如川菜+韩料）
    // 需要分桶排序：融合桶 + 偏好A桶 + 偏好B桶，两边各保位置
    // 聚合 intent.preferences 和 intent.members 偏好，确保多人模式偏好只放在 members 时也能分桶
    const uniquePrefs = [...new Set([
      ...(intent.preferences || []),
      ...(intent.members || []).flatMap(m => m.preferences || []),
    ])];
    // 只要有多偏好且有餐厅匹配了至少1个偏好就分桶
    // 不要求必须有融合餐厅（同时匹配2个偏好的），否则日料+韩料无融合店时不分桶，只返回一边
    const hasMultiCategoryPrefs = uniquePrefs.length >= 2 && scoredRestaurants.some(r => r._matchedPrefs && r._matchedPrefs.length >= 1);

    if (hasMultiCategoryPrefs) {
      // 地方菜系大类：桶偏好是地方菜系时，麻辣香锅/冒菜/串串/麻辣烫等子类降权到真菜系馆后面
      // 火锅单独保留不降权（用户确认）
      const LOCAL_CUISINES = CUISINE_KEYWORDS_FOR_FILTER['地方菜系'] || [];
      const SUB_CUISINE_KEYWORDS = ['麻辣香锅', '冒菜', '串串', '麻辣烫'];
      const localCuisinePurity = (r, pref) => {
        if (!LOCAL_CUISINES.includes(pref)) return 0;
        const text = [r.name || '', r.cuisine || '', ...(r.tags || []), ...(r.features || [])].join('');
        return SUB_CUISINE_KEYWORDS.some(kw => text.includes(kw)) ? 1 : 0;
      };

      // 分3桶
      const fusionBucket = scoredRestaurants.filter(r => r._matchedPrefs && r._matchedPrefs.length >= 2);
      const prefA = uniquePrefs[0];
      const prefB = uniquePrefs[1];
      const bucketA = scoredRestaurants.filter(r => r._matchedPrefs && r._matchedPrefs.length === 1 && r._matchedPrefs.includes(prefA));
      const bucketB = scoredRestaurants.filter(r => r._matchedPrefs && r._matchedPrefs.length === 1 && r._matchedPrefs.includes(prefB));
      const otherBucket = scoredRestaurants.filter(r => !r._matchedPrefs || r._matchedPrefs.length === 0);

      // Step 1: 融合桶 MMR 取 Top min(3, 桶大小)
      const fusionRanked = mmrRerank(
        [...fusionBucket].sort((a, b) => getScore(b) - getScore(a)),
        intent
      );
      const fusionCount = Math.min(3, fusionRanked.length);
      const fusionPicks = fusionRanked.slice(0, fusionCount);
      const usedIds = new Set(fusionPicks.map(r => r.id));

      // Step 2: 根据融合桶偏向分配剩余位置
      const remainingSlots = MAX_RESULTS - fusionPicks.length;
      let slotsA, slotsB;
      if (fusionCount === 0) {
        // 无融合餐厅：两边均分（A多1个，因为A是第一个偏好）
        slotsA = Math.ceil(remainingSlots / 2);
        slotsB = remainingSlots - slotsA;
      } else {
        // 判断融合桶偏向：检查融合桶里的餐厅更偏向哪个偏好
        const fusionMatchA = fusionPicks.filter(r => r._matchedPrefs.includes(prefA)).length;
        const fusionMatchB = fusionPicks.filter(r => r._matchedPrefs.includes(prefB)).length;
        if (fusionMatchA > fusionMatchB) {
          // 融合桶偏A → B桶多分
          slotsB = Math.ceil(remainingSlots / 2);
          slotsA = remainingSlots - slotsB;
        } else if (fusionMatchB > fusionMatchA) {
          // 融合桶偏B → A桶多分
          slotsA = Math.ceil(remainingSlots / 2);
          slotsB = remainingSlots - slotsA;
        } else {
          // 均衡 → 两边均分
          slotsA = Math.ceil(remainingSlots / 2);
          slotsB = remainingSlots - slotsA;
        }
      }

      // Step 3: 每个偏好桶内 MMR 后取对应数量
      const picksA = mmrRerank(
        [...bucketA].sort((a, b) => getScore(b) - getScore(a)),
        intent
      )
        .filter(r => !usedIds.has(r.id))
        .sort((a, b) => localCuisinePurity(a, prefA) - localCuisinePurity(b, prefA))
        .slice(0, slotsA);
      picksA.forEach(r => usedIds.add(r.id));

      const picksB = mmrRerank(
        [...bucketB].sort((a, b) => getScore(b) - getScore(a)),
        intent
      )
        .filter(r => !usedIds.has(r.id))
        .sort((a, b) => localCuisinePurity(a, prefB) - localCuisinePurity(b, prefB))
        .slice(0, slotsB);
      picksB.forEach(r => usedIds.add(r.id));

      balancedResults = [...fusionPicks, ...picksA, ...picksB];

      // 不足补齐：从其他桶补
      if (balancedResults.length < MAX_RESULTS) {
        const pool = [...otherBucket, ...bucketA, ...bucketB]
          .filter(r => !usedIds.has(r.id))
          .sort((a, b) => getScore(b) - getScore(a));
        for (const r of pool) {
          if (balancedResults.length >= MAX_RESULTS) break;
          balancedResults.push(r);
          usedIds.add(r.id);
        }
      }
    } else {
      // 常规无冲突场景：直接按 matchScore 排序
      scoredRestaurants.sort((a, b) => getScore(b) - getScore(a));
      balancedResults = applyTierRanking(scoredRestaurants, MAX_RESULTS);
    }
  }

  // 防御性处理：确保所有餐厅都有有效的 matchScore
  const safeResults = balancedResults.slice(0, MAX_RESULTS).map(r => {
    if (typeof r.matchScore !== 'number' || isNaN(r.matchScore)) {
      const fallbackScore = calculateSingleScore(r, intent);
      return {
        ...r,
        matchScore: (fallbackScore && typeof fallbackScore.score === 'number' && !isNaN(fallbackScore.score)) ? fallbackScore.score : 75,
        reasons: fallbackScore?.reasons || r.reasons || [],
      };
    }
    return r;
  });

  // 最终去重：多个搜索路径可能返回同一餐厅（id 相同或 name+address 相同）
  // 同时兜底排除 excludeIds（已推荐/已排除的餐厅不再出现）
  const seenFinal = new Set();
  const uniqueResults = safeResults.filter(r => {
    if (excludeIds.includes(r.id)) return false;
    const key = r.id || `${r.name}__${r.address}`;
    if (seenFinal.has(key)) return false;
    seenFinal.add(key);
    return true;
  });

  return uniqueResults;
}

// ============ 按模式推荐（调度入口） ============

export async function recommendByMode(mode, location, extraIntent = null, fortuneCard = null, excludeId = null, excludeIds = []) {
  const modeIntent = getModeIntent(mode);

  const mergedIntent = {
    preferences: [],
    allergies: [],
    ...modeIntent,
  };

  if (extraIntent) {
    if (extraIntent.preferences && modeIntent.preferences) {
      mergedIntent.preferences = [...modeIntent.preferences, ...extraIntent.preferences];
    } else if (extraIntent.preferences) {
      mergedIntent.preferences = extraIntent.preferences;
    }

    if (extraIntent.allergies && modeIntent.allergies) {
      mergedIntent.allergies = [...modeIntent.allergies, ...extraIntent.allergies];
    } else if (extraIntent.allergies) {
      mergedIntent.allergies = extraIntent.allergies;
    }

    // 价格范围（偏好微调）：优先于 budget
    if (extraIntent.priceRange) {
      mergedIntent.priceRange = extraIntent.priceRange;
    } else if (extraIntent.budget !== undefined && extraIntent.budget !== null) {
      mergedIntent.budget = extraIntent.budget;
    } else if (modeIntent.budget !== undefined && modeIntent.budget !== null) {
      mergedIntent.budget = modeIntent.budget;
    }

    // 距离范围（偏好微调）
    if (extraIntent.distRange) {
      mergedIntent.distRange = extraIntent.distRange;
    }
  }

  // 严格过滤：价格范围 + 用户额外添加的菜系口味标签 + 距离范围
  const priceRange = mergedIntent.priceRange;
  const distRange = mergedIntent.distRange;
  const prefTags = extraIntent?.preferences || [];
  // 不可回退过滤：口味标签（即使候选为空也必须保持，否则推荐无意义）
  const hardFilters = prefTags.length > 0 ? (list) => {
    return list.filter(r => {
      const allFeatures = [...(r.tags || []), ...(r.features || []), r.cuisine || ''];
      const allText = allFeatures.join('');
      return prefTags.some(tag => {
        const mappedKeywords = CUISINE_KEYWORDS_FOR_FILTER[tag];
        if (mappedKeywords) {
          return mappedKeywords.some(kw => allText.includes(kw));
        }
        return allFeatures.some(f => f.includes(tag) || tag.includes(f));
      });
    });
  } : null;
  const applyPrefFilter = (candidates) => {
    let filtered = candidates;
    // 探索模式：距离由搜索半径控制，预算由探索评分软约束，不硬过滤
    if (distRange && !isExploreMode) {
      const [minKm, maxKm] = distRange;
      const minMin = minKm * 12;
      const maxMin = maxKm >= 5 ? Infinity : maxKm * 12;
      filtered = filtered.filter(r => {
        const dist = r.distance || 0;
        return dist >= minMin && dist <= maxMin;
      });
    }
    // 美食分类标签过滤（用 hardFilters）
    if (hardFilters) {
      filtered = hardFilters(filtered);
    }
    return filtered;
  };

  const isExploreMode = [SOLO_MODES.EXPLORE_NEAR, SOLO_MODES.EXPLORE_MID, SOLO_MODES.EXPLORE_FAR, SOLO_MODES.EXPLORE_ANY].includes(mode);

  if (isExploreMode) {
    const radius = getExploreRadius(mode);
    const treasure = await exploreHiddenTreasures(location, radius, applyPrefFilter, mode, excludeIds, hardFilters, priceRange);
    if (treasure) {
      const modeConfig = getSoloModes()[mode];
      return [{
        ...treasure,
        matchScore: treasure.matchScore || treasure.score || 50,
        reasons: treasure.reasons || [{ type: 'match', text: `探索发现：${modeConfig?.description || '被埋没的宝藏店'}` }],
        soloFriendly: calculateSoloFriendly(treasure),
        isExploreMode: true,
        exploreMode: mode,
        exploreMessage: treasure.exploreMessage || `${modeConfig?.description || '被埋没的宝藏店'}`,
      }];
    }
    return [];
  }

  if (mode === SOLO_MODES.FORTUNE) {
    const result = await recommendFortune(location, fortuneCard, applyPrefFilter, excludeId, excludeIds, mergedIntent.allergies);
    return result ? [result] : [];
  }

  let results = await recommendRestaurants(mergedIntent, location, excludeIds);
  // 对最终结果应用偏好过滤
  if (priceRange || distRange || prefTags.length > 0) {
    results = applyPrefFilter(results);
  }

  // 按心情选场景：MMR 多样性重排（保 Top1 相关性，后续打散同质菜系）
  const SOLO_MMR_LAMBDA = {
    [SOLO_MODES.INDULGE]: 0.45,
    [SOLO_MODES.COLD]: 0.48,
    [SOLO_MODES.LIGHT]: 0.55,
    [SOLO_MODES.TIRED]: 0.6,
  };
  if (SOLO_MMR_LAMBDA[mode] && results.length > 3) {
    results = mmrRerank(results, mergedIntent, {
      lambda: SOLO_MMR_LAMBDA[mode],
      skipFirstN: 1,
      enableForSolo: true,
    });
  }

  return results;
}

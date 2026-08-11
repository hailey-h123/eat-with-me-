/**
 * 推荐服务（主入口）
 * 包含: 单人模式配置、群体推荐主流程、recommendByMode 调度
 */
import { mockRestaurants } from '../data/mockRestaurants';
import { CUISINE_KEYWORDS_FOR_FILTER, CUISINE_SEMANTIC_MAP } from '../data/cuisineMap';
import { searchPOI, haversineDistance } from './amapService';
import { applyFeedbackToScore } from './feedbackService';
import {
  checkPrefMatch,
  countSafeSignals,
  featuresMatchPreference,
  calculateSoloFriendly,
  calculateGroupScore,
  calculateSingleScore,
  filterByAllergies,
  getCuisineSearchKeys,
  getFusionSearchKeywords,
  getExpandedSearchKeyword,
  filterExpansionsByAllergies,
  mmrRerank,
  analyzeEmptyResult,
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
        searchKeyword: '西餐|外国餐厅|咖啡厅|面包蛋糕|沙拉|简餐',
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
        return (results && results.length > 0) ? results.slice(0, 15) : [];
      } catch (e) {
        return [];
      }
    });
    const cuisineSearchResults = await Promise.all(cuisineSearchTasks);
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
        return { fusionKey, results: (results && results.length > 0) ? results.slice(0, 8) : [] };
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
            if (!expandedSeenIds.has(r.id)) { expandedSeenIds.add(r.id); candidates.push(r); }
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
    candidates = candidates.filter(r => {
      const price = r.price;
      if (price == null || price <= 0 || isNaN(price)) return true; // 保留：价格未知，不硬踢
      const noCap = (maxP === null || maxP >= 200);
      const inRange = noCap ? price >= minP : (price >= minP && price <= maxP);
      return inRange;
    });

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
        const filtered = newOnes.filter(r => {
          const price = r.price;
          if (price == null || price <= 0 || isNaN(price)) return true; // 保留：价格未知，不硬踢
          const noCap = (maxP === null || maxP >= 200);
          return noCap ? price >= minP : (price >= minP && price <= maxP);
        });
        candidates.push(...filtered);
      }
      // 仍然不足，用通用"餐厅"搜索 + 更大半径
      if (candidates.length < MIN_CANDIDATES_AFTER_PRICE) {
        const broad = await searchPOI('餐厅', searchCenter, 5000);
        if (broad && broad.length > 0) {
          const newOnes = broad.filter(r => !excludeIds.includes(r.id) && !candidates.some(c => c.id === r.id));
          const filtered = newOnes.filter(r => {
            const price = r.price;
            if (price == null || price <= 0 || isNaN(price)) return true; // 保留：价格未知，不硬踢
            const noCap = (maxP === null || maxP >= 200);
          return noCap ? price >= minP : (price >= minP && price <= maxP);
          });
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

    async function expandWith(keyword, radius) {
      const results = await searchPOI(keyword, searchCenter, radius);
      if (!results || results.length === 0) return;
      let batch = results.filter(r => !excludeIds.includes(r.id) && !expandedSeenIds.has(r.id));
      if (batch.length === 0) return;
      batch = filterByAllergies(batch, intent.allergies, intent.conflicts || []);
      // 相关性验证：结合 cuisine + name + tags 综合判断
      {
        const terms = keyword.split('|').filter(Boolean);
        if (terms.length > 0) {
          batch = batch.filter(r => {
            const searchText = [r.cuisine || '', r.name || '', ...(r.tags || []), ...(r.features || []), ...(r.featureTags || [])].join('');
            return terms.some(t => searchText.includes(t));
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
          const price = r.price;
          if (price == null || price <= 0 || isNaN(price)) return true;
          const noCap = (maxP === null || maxP >= 200);
          return noCap ? price >= minP : (price >= minP && price <= maxP);
        });
      }
      const fresh = batch.slice(0, MAX_RESULTS);
      fresh.forEach(r => { r._isExpanded = true; expandedSeenIds.add(r.id); });
      candidates.push(...fresh);
    }

    const expandRadius = Math.max(searchRadius * 2, 5000);

    // 分批并行：高德免费版 QPS≈5，每批最多 2 个并发 + 批间 300ms 间隔，避免 10021 超限
    async function expandBatch(keywords) {
      const BATCH_SIZE = 2;
      const BATCH_DELAY = 300;
      const expandedKeywords = keywords.map(kw => getExpandedSearchKeyword(kw));
      for (let i = 0; i < expandedKeywords.length; i += BATCH_SIZE) {
        const batch = expandedKeywords.slice(i, i + BATCH_SIZE);
        await Promise.all(batch.map(kw => expandWith(kw, expandRadius)));
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
    const EXPANSION_MAP = {
      '辣': ['火锅', '湘菜', '贵州菜', '云南菜', '江西菜', '粤菜', '江浙菜'],
      '素食': ['火锅', '粤菜', '江浙菜', '日料', '西餐', '云南菜', '东北菜', '川菜', '湘菜'],
      '海鲜': ['火锅', '东北菜', '北京菜', '鲁菜', '西北菜', '川菜', '湘菜', '韩餐', '西餐', '贵州菜', '江西菜', '云南菜', '新疆菜'],
      '减肥': ['日料', '粤菜', '江浙菜', '轻食', '沙拉', '健康餐', '火锅', '云南菜', '东南亚', '西餐', '韩餐'],
      '低卡': ['日料', '粤菜', '江浙菜', '轻食', '沙拉', '健康餐', '火锅', '云南菜', '东南亚', '西餐', '韩餐'],
    };

    const selfSet = SELF_RESOLVING[conflictAllergy];
    if (selfSet && selfSet.has(pref)) {
      // 自化解品类：只扩半径搜自己（子品类通过 getExpandedSearchKeyword 自然覆盖）
      await expandBatch([pref]);
    } else if (EXPANSION_MAP[conflictAllergy]) {
      await expandBatch(EXPANSION_MAP[conflictAllergy]);
    }
  }

  // 群体评分
  const scoredRestaurants = candidates.map(restaurant => {
    const { score, reasons, _groupMin, _groupAvg, solutionTier, compromiseDetails, memberScores } = calculateGroupScore(restaurant, intent);
    let adjustedScore = applyFeedbackToScore(restaurant, score);

    // 扩张补偿：扩张来的关联菜系 +8，原始菜系但没信号 -8
    // 同义词保护：寿喜烧等子品类（featuresMatchPreference命中）不扣分
    if (needsExpand && conflictAllergy) {
      if (restaurant._isExpanded) {
        adjustedScore += 8;
      } else {
        const sig = countSafeSignals(restaurant, conflictAllergy);
        if (sig === 0) {
          const allTags = [...(restaurant.tags||[]), ...(restaurant.features||[]), restaurant.cuisine||'', restaurant.name||''];
          const isSynonym = featuresMatchPreference(allTags, activeConflicts[0]?.preference || '');
          if (!isSynonym) adjustedScore -= 8;
        }
      }
    }

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
    // 分层：原始菜系 vs 关联菜系，各自精排
    const original = scoredRestaurants.filter(r => !r._isExpanded);
    const expanded = scoredRestaurants.filter(r => r._isExpanded);

    const TOP_ORIGINAL = Math.min(2, original.length);
    const TOP_EXPANDED = Math.min(MAX_RESULTS - TOP_ORIGINAL, expanded.length);

    const originalRanked = applyTierRanking(original, TOP_ORIGINAL);
    const expandedRanked = applyTierRanking(expanded, TOP_EXPANDED);

    balancedResults = [...originalRanked, ...expandedRanked];

    // 分轨拼接后全局再按满意人数 → tier → score 排序
    // 避免原始菜系里只满足1人的餐厅排在关联菜系里满足2人的前面
    balancedResults.sort((a, b) => {
      const aSat = satisfiedCount(a);
      const bSat = satisfiedCount(b);
      if (aSat !== bSat) return bSat - aSat;
      const aT = a.solutionTier ?? 3;
      const bT = b.solutionTier ?? 3;
      if (aT !== bT) return aT - bT;
      return getScore(b) - getScore(a);
    });

    // 不足补齐
    if (balancedResults.length < MAX_RESULTS) {
      const used = new Set(balancedResults.map(r => r.id));
      for (const r of original) {
        if (balancedResults.length >= MAX_RESULTS) break;
        if (!used.has(r.id)) { balancedResults.push(r); }
      }
      for (const r of expanded) {
        if (balancedResults.length >= MAX_RESULTS) break;
        if (!used.has(r.id)) { balancedResults.push(r); }
      }
    }
  } else {
    // 无冲突：全体跑 MMR + tier
    balancedResults = applyTierRanking(scoredRestaurants, MAX_RESULTS);
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
  const seenFinal = new Set();
  const uniqueResults = safeResults.filter(r => {
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
    // 价格范围过滤
    if (priceRange) {
      const [minP, maxP] = priceRange;
      filtered = filtered.filter(r => {
        const price = r.price;
        if (price == null || price <= 0 || isNaN(price)) {
          return true;
        }
        const noCap = (maxP === null || maxP >= 200);
        const inRange = noCap ? price >= minP : (price >= minP && price <= maxP);
        return inRange;
      });
    }
    // 距离范围过滤
    if (distRange) {
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
    const treasure = await exploreHiddenTreasures(location, radius, applyPrefFilter, mode, excludeIds, hardFilters);
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
  return results;
}

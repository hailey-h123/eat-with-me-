/**
 * 推荐服务（主入口）
 * 包含: 单人模式配置、群体推荐主流程、recommendByMode 调度
 */
import { mockRestaurants } from '../data/mockRestaurants';
import { searchPOI } from './amapService';
import { applyFeedbackToScore } from './feedbackService';
import {
  CUISINE_KEYWORDS_FOR_FILTER,
  calculateSoloFriendly,
  calculateGroupScore,
  calculateSingleScore,
  filterByAllergies,
  getCuisineSearchKeys,
  getFusionSearchKeywords,
  getExpandedSearchKeyword,
  balanceDiversity,
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
      !['减肥', '安静', '热闹', '环境好', '实惠'].includes(p)
    ));
  }

  if (keywords.length === 0) {
    keywords.push('餐厅');
  }

  return keywords.join('|');
}

// ============ 群体推荐主流程 ============

/**
 * 群体推荐
 */
export async function recommendRestaurants(intent, location, excludeIds = []) {
  let candidates = [];
  const seenIds = new Set();

  const cuisineKeys = getCuisineSearchKeys(intent);

  if (location && cuisineKeys.length >= 2) {
    // 多菜系：用扩展关键词分别搜索每个菜系，追踪每个餐厅命中了哪些菜系
    // 扩展关键词解决烤涮一体等跨菜系餐厅因标签不匹配搜不到的问题
    // 例如：搜索"烤肉|烧烤|韩式烤肉|日式烤肉|烧肉"代替仅搜"烤肉"
    const candidateCuisines = new Map(); // id -> Set<cuisineKey>
    for (const key of cuisineKeys) {
      try {
        const searchKeyword = getExpandedSearchKeyword(key);
        const results = await searchPOI(searchKeyword, location, 3000);
        if (results && results.length > 0) {
          results.slice(0, 15).forEach(r => {
            if (excludeIds.includes(r.id)) return;
            if (!seenIds.has(r.id)) {
              seenIds.add(r.id);
              candidates.push(r);
              candidateCuisines.set(r.id, new Set([key]));
            } else {
              candidateCuisines.get(r.id)?.add(key);
            }
          });
        }
      } catch (e) {
        // 单菜系搜索失败，跳过
      }
    }

    // 融合候选：同时命中多个菜系搜索的餐厅 → 天然跨菜系
    const fusionIds = new Set();
    for (const [id, keys] of candidateCuisines) {
      if (keys.size >= 2) fusionIds.add(id);
    }

    // 补充搜索：用菜系组合词扩大候选池（如"火锅烧烤"比"烤涮一体"更真实），扩大搜索半径
    const fusionKeywords = getFusionSearchKeywords(intent);
    for (const fusionKey of fusionKeywords) {
      try {
        const results = await searchPOI(fusionKey, location, 5000);
        if (results && results.length > 0) {
          results.slice(0, 8).forEach(r => {
            if (!seenIds.has(r.id) && !excludeIds.includes(r.id)) {
              seenIds.add(r.id);
              candidates.push({ ...r, _fusionKeyword: fusionKey });
              fusionIds.add(r.id);
            }
          });
        }
      } catch (e) {
        // 融合关键词搜索失败，跳过
      }
    }

    // 将融合候选排到最前面
    if (fusionIds.size > 0) {
      const fusionCandidates = candidates.filter(c => fusionIds.has(c.id));
      const otherCandidates = candidates.filter(c => !fusionIds.has(c.id));
      candidates = [...fusionCandidates, ...otherCandidates];
    }
  }

  // 单菜系、或分别搜索无结果时，回退到合并搜索
  if (candidates.length === 0) {
    const keyword = buildSearchKeyword(intent);
    const realRestaurants = location ? await searchPOI(keyword, location, 3000) : null;

    if (realRestaurants && realRestaurants.length > 0) {
      candidates = realRestaurants.filter(r => !excludeIds.includes(r.id));
    } else if (location) {
      // 兜底：用通用"餐厅"搜索
      const fallbackResults = await searchPOI('餐厅', location, 3000);
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
  if (intent.conflictAltKeywords && intent.conflictAltKeywords.length > 0 && location) {
    for (const altKeyword of intent.conflictAltKeywords) {
      try {
        const altResults = await searchPOI(altKeyword, location, 3000);
        if (altResults && altResults.length > 0) {
          altResults.forEach(r => {
            if (!seenIds.has(r.id)) { seenIds.add(r.id); candidates.push(r); }
          });
        }
      } catch (e) {
        // 冲突补充搜索失败，跳过
      }
    }
  }

  // 硬约束过滤（一票否决）
  candidates = filterByAllergies(candidates, intent.allergies, intent.conflicts || []);

  // 最低评分过滤
  if (intent.minRating) {
    candidates = candidates.filter(r => {
      const rating = r.rating || 0;
      return rating >= intent.minRating;
    });
  }

  // 将个人 budget 和 minBudget 转为 priceRange，确保硬过滤生效
  if (!intent.priceRange && (intent.budget || intent.minBudget)) {
    const minP = intent.minBudget || 0;
    const maxP = intent.budget || 999;
    intent.priceRange = [minP, maxP];
  }

  // 价格范围过滤（在评分前过滤）
  if (intent.priceRange) {
    const [minP, maxP] = intent.priceRange;
    candidates = candidates.filter(r => {
      const price = r.price;
      if (price == null || price <= 0 || isNaN(price)) return false;
      const inRange = maxP >= 200 ? price >= minP : (price >= minP && price <= maxP);
      return inRange;
    });

    // 候选不足时，扩大搜索范围
    if (candidates.length < 5 && location) {
      const keyword = buildSearchKeyword(intent);
      const page2 = await searchPOI(keyword, location, 5000, 0, 0, 2);
      if (page2 && page2.length > 0) {
        const newOnes = page2.filter(r => !excludeIds.includes(r.id) && !candidates.some(c => c.id === r.id));
        const filtered = newOnes.filter(r => {
          const price = r.price;
          if (price == null || price <= 0 || isNaN(price)) return false;
          return maxP >= 200 ? price >= minP : (price >= minP && price <= maxP);
        });
        candidates.push(...filtered);
      }
      // 仍然不足，用通用"餐厅"搜索 + 更大半径
      if (candidates.length < 5) {
        const broad = await searchPOI('餐厅', location, 5000);
        if (broad && broad.length > 0) {
          const newOnes = broad.filter(r => !excludeIds.includes(r.id) && !candidates.some(c => c.id === r.id));
          const filtered = newOnes.filter(r => {
            const price = r.price;
            if (price == null || price <= 0 || isNaN(price)) return false;
            return maxP >= 200 ? price >= minP : (price >= minP && price <= maxP);
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

  // 群体评分
  const scoredRestaurants = candidates.map(restaurant => {
    const { score, reasons } = calculateGroupScore(restaurant, intent);
    const adjustedScore = applyFeedbackToScore(restaurant, score);
    return {
      ...restaurant,
      matchScore: adjustedScore,
      reasons,
      soloFriendly: calculateSoloFriendly(restaurant),
    };
  });

  scoredRestaurants.sort((a, b) => {
    const aScore = typeof a.matchScore === 'number' && !isNaN(a.matchScore) ? a.matchScore : 0;
    const bScore = typeof b.matchScore === 'number' && !isNaN(b.matchScore) ? b.matchScore : 0;
    return bScore - aScore;
  });

  // 多样性平衡：确保不同菜系都有代表，但最终按匹配度降序排列
  const balancedResults = balanceDiversity(scoredRestaurants, intent);
  // 按分数降序，同分时融合餐厅优先
  balancedResults.sort((a, b) => {
    const aScore = typeof a.matchScore === 'number' && !isNaN(a.matchScore) ? a.matchScore : 0;
    const bScore = typeof b.matchScore === 'number' && !isNaN(b.matchScore) ? b.matchScore : 0;
    if (Math.abs(aScore - bScore) < 0.5) {
      // 同分：融合餐厅（匹配多菜系）排在前面
      const aFusion = (a._matchedCuisines || 0) > 1 ? 1 : 0;
      const bFusion = (b._matchedCuisines || 0) > 1 ? 1 : 0;
      return bFusion - aFusion;
    }
    return bScore - aScore;
  });

  // 防御性处理：确保所有餐厅都有有效的 matchScore
  const safeResults = balancedResults.slice(0, 5).map(r => {
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
        const inRange = maxP >= 200 ? price >= minP : (price >= minP && price <= maxP);
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
    // 美食分类标签过滤
    if (prefTags.length > 0) {
      filtered = filtered.filter(r => {
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
    }
    return filtered;
  };

  const isExploreMode = [SOLO_MODES.EXPLORE_NEAR, SOLO_MODES.EXPLORE_MID, SOLO_MODES.EXPLORE_FAR, SOLO_MODES.EXPLORE_ANY].includes(mode);

  if (isExploreMode) {
    const radius = getExploreRadius(mode);
    const treasure = await exploreHiddenTreasures(location, radius, applyPrefFilter, mode, excludeIds);
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
    const result = await recommendFortune(location, fortuneCard, applyPrefFilter, excludeId, excludeIds);
    return result ? [result] : [];
  }

  let results = await recommendRestaurants(mergedIntent, location, excludeIds);
  // 对最终结果应用偏好过滤
  if (priceRange || distRange || prefTags.length > 0) {
    results = applyPrefFilter(results);
  }
  return results;
}

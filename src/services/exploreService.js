/**
 * 探索模式服务
 * 包含: 探索模式配置、隐藏宝藏店搜索、randomExplore 逻辑
 */
import { mockRestaurants } from '../data/mockRestaurants';
import { searchPOI, searchPOIByDistanceRanges } from './amapService';
import { applyFeedbackToScore } from './feedbackService';
import {
  CUISINE_KEYWORDS_FOR_FILTER,
  calculateSoloFriendly,
  calculateSingleScore,
} from './scoringService';

const EXPLORE_MODES = {
  FRESH: 'fresh',
};

const FRESH_MESSAGES = [
  '大家都没想到，但这家评价超棒！',
  '跳出舒适圈，试试这个意想不到的选择',
  '都在纠结？换个口味，这家意外地靠谱',
  '打破常规的时候到了，这家口碑说明一切',
];

function getExploreMessage(mode, restaurant, timeContext) {
  return FRESH_MESSAGES[Math.floor(Math.random() * FRESH_MESSAGES.length)];
}

function getRestaurantStory(restaurant, mode) {
  const stories = [
    `大家可能都没想过吃${restaurant.cuisine}，但${restaurant.name}在当地评价名列前茅`,
    `换个思路！${restaurant.name}虽然不在你们的预期里，但绝对是惊喜之选`,
    `打破常规的时候到了，${restaurant.name}的口碑说明一切`,
    `谁说聚餐只能吃那几样？${restaurant.name}会给你们带来全新体验`,
  ];
  return stories[Math.floor(Math.random() * stories.length)];
}

const EXPLORE_HISTORY_KEY = 'eatwithme_explore_history';

export function getExploreHistory() {
  try {
    const data = localStorage.getItem(EXPLORE_HISTORY_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function addToExploreHistory(restaurant) {
  try {
    const history = getExploreHistory();
    history.unshift({
      id: restaurant.id,
      name: restaurant.name,
      timestamp: Date.now(),
    });
    const trimmed = history.slice(0, 20);
    localStorage.setItem(EXPLORE_HISTORY_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore
  }
}

export function isAlreadyExplored(restaurantId) {
  const history = getExploreHistory();
  return history.some(item => item.id === restaurantId);
}

export function calculateGroupFriendly(restaurant) {
  let score = 50;
  const allText = [
    ...(restaurant.tags || []),
    ...(restaurant.features || []),
    restaurant.cuisine || '',
    restaurant.name || '',
  ].join('').toLowerCase();

  if (allText.includes('火锅') || allText.includes('烤肉') || allText.includes('自助') || allText.includes('烧烤')) {
    score += 25;
  }
  if (allText.includes('包间') || allText.includes('大桌') || allText.includes('包厢')) {
    score += 20;
  }
  if (allText.includes('吧台') || allText.includes('单人')) {
    score -= 15;
  }

  return Math.max(0, Math.min(100, score));
}

/**
 * 探索隐藏宝藏店
 */
export async function exploreHiddenTreasures(location, radius = 3000, applyPrefFilter = null, mode = null, excludeIds = [], hardFilters = null) {
  let candidates = [];
  const radiusKm = radius / 1000;

  let targetMinMeters = 0;
  let targetMaxMeters = radius;

  if (radiusKm <= 0.5) {
    targetMinMeters = 100;
    targetMaxMeters = 500;
  } else if (radiusKm <= 1) {
    targetMinMeters = 500;
    targetMaxMeters = 1000;
  } else if (radiusKm <= 3) {
    targetMinMeters = 1000;
    targetMaxMeters = 3000;
  } else if (radiusKm <= 5) {
    targetMinMeters = 3000;
    targetMaxMeters = 5000;
  } else {
    targetMinMeters = 5000;
    targetMaxMeters = Math.max(radius, 8000);
  }

  const minMinutes = Math.ceil(targetMinMeters / 80);
  const maxMinutes = Math.ceil(targetMaxMeters / 80);

  const filterByDistance = (list) => {
    return list.filter(r => {
      const d = r.distance || 0;
      const dm = r.distanceMeters || 0;
      if (dm > 0) {
        return dm >= targetMinMeters && dm <= targetMaxMeters;
      }
      return d >= minMinutes && d <= maxMinutes;
    });
  };

  const filterByExcludeIds = (list) => {
    if (!excludeIds || excludeIds.length === 0) return list;
    return list.filter(r => !excludeIds.includes(r.id));
  };

  const applyAllFilters = (list) => {
    let result = filterByExcludeIds(list);
    result = filterByDistance(result);
    return result;
  };

  if (location) {
    const ranges = [
      { min: targetMinMeters, max: Math.min(targetMinMeters + 1000, targetMaxMeters) },
      { min: Math.min(targetMinMeters + 1000, targetMaxMeters), max: Math.min(targetMinMeters + 2000, targetMaxMeters) },
      { min: Math.min(targetMinMeters + 2000, targetMaxMeters), max: targetMaxMeters },
    ].filter(r => r.min < r.max);

    const results = await searchPOIByDistanceRanges('餐厅', location, ranges);

    if (results && results.length > 0) {
      candidates = results.map(r => ({ ...r, isMock: false }));
    } else {
      const allResults = await searchPOI('餐厅', location, radius);
      if (allResults && allResults.length > 0) {
        candidates = allResults.map(r => ({ ...r, isMock: false }));
      }
    }
  }

  if (candidates.length === 0) {
    candidates = [...mockRestaurants].map(r => ({ ...r, isMock: true }));
  }

  candidates = applyAllFilters(candidates);

  if (candidates.length === 0) {
    if (location) {
      const largerRadius = Math.min(radius * 2, 10000);
      const allResults = await searchPOI('餐厅', location, largerRadius);
      if (allResults && allResults.length > 0) {
        const newCandidates = allResults.map(r => ({ ...r, isMock: false }));
        candidates = applyAllFilters(newCandidates);
      }
    }
    if (candidates.length === 0) {
      const mockFiltered = applyAllFilters([...mockRestaurants].map(r => ({ ...r, isMock: true })));
      if (mockFiltered.length > 0) {
        candidates = mockFiltered;
      } else {
        candidates = filterByExcludeIds([...mockRestaurants].map(r => ({ ...r, isMock: true })));
      }
    }
  }

  if (applyPrefFilter) {
    candidates = applyPrefFilter(candidates);
    if (candidates.length === 0) {
      // 过滤后为空：重新搜索候选，但仍应用 hardFilters（口味标签等不可回退过滤）
      // 价格和距离过滤可放宽，但口味标签必须保持
      if (location) {
        const allResults = await searchPOI('餐厅', location, radius, targetMinMeters, targetMaxMeters);
        if (allResults && allResults.length > 0) {
          let newCandidates = allResults.map(r => ({ ...r, isMock: false }));
          if (hardFilters) newCandidates = hardFilters(newCandidates);
          candidates = filterByExcludeIds(newCandidates);
        }
      }
      if (candidates.length === 0) {
        if (location) {
          const largerRadius = Math.min(radius * 2, 10000);
          const allResults = await searchPOI('餐厅', location, largerRadius);
          if (allResults && allResults.length > 0) {
            let newCandidates = allResults.map(r => ({ ...r, isMock: false }));
            if (hardFilters) newCandidates = hardFilters(newCandidates);
            candidates = applyAllFilters(newCandidates);
          }
        }
      }
      if (candidates.length === 0) {
        let mockFiltered = applyAllFilters([...mockRestaurants].map(r => ({ ...r, isMock: true })));
        if (hardFilters) mockFiltered = hardFilters(mockFiltered);
        if (mockFiltered.length > 0) {
          candidates = mockFiltered;
        } else {
          // 如果连 mock 数据都不满足 hardFilters，返回空，让上层显示空结果建议
          return null;
        }
      }
    }
  }

  const hiddenTreasures = candidates.filter(r => {
    const reviewCount = r.reviewCount || 0;
    const rating = r.rating || 0;
    if (r.isMock || reviewCount === 0) {
      return rating >= 4.0;
    }
    return reviewCount < 500 && reviewCount > 0 && rating >= 4.0;
  });

  let resultCandidates;
  if (hiddenTreasures.length > 0) {
    resultCandidates = hiddenTreasures;
  } else {
    const sortedByRating = [...candidates].sort((a, b) => (b.rating || 0) - (a.rating || 0));
    resultCandidates = sortedByRating.slice(0, 10);
  }

  const scored = resultCandidates.map(r => {
    const rating = r.rating || 4.0;
    const distance = r.distance || 0;
    const price = r.price;
    const photoCount = (r.photos || []).length;
    const tagCount = (r.featureTags || []).length;

    // 1. 评分维度（30%）
    const ratingScore = Math.pow((rating - 3.5) / 1.5, 1.2) * 100;

    // 2. 距离维度（30%）
    let distanceScore;
    if (distance === 0) {
      distanceScore = 15;
    } else {
      const idealDist = Math.round((maxMinutes + minMinutes) / 2);
      const sigma = (maxMinutes - minMinutes) / 3;
      distanceScore = Math.exp(-Math.pow(distance - idealDist, 2) / (2 * Math.pow(sigma, 2))) * 100;
    }

    // 3. 价格合理性（15%）
    let priceScore;
    if (price && price > 0) {
      if (price <= 150 && price >= 30) {
        priceScore = 100;
      } else if (price < 30) {
        priceScore = 70;
      } else {
        priceScore = Math.max(50, 100 - (price - 150) * 0.3);
      }
    } else {
      priceScore = 40;
    }

    // 4. 信息丰富度（15%）
    let infoScore = 50;
    if (photoCount >= 3) infoScore += 25;
    else if (photoCount >= 1) infoScore += 15;
    if (tagCount >= 2) infoScore += 25;
    else if (tagCount >= 1) infoScore += 15;
    infoScore = Math.min(100, infoScore);

    // 5. 宝藏属性（10%）
    let treasureScore;
    const isLikelyChain = photoCount >= 5 && tagCount >= 4;
    if (rating >= 4.5 && !isLikelyChain) {
      treasureScore = 100;
    } else if (rating >= 4.3) {
      treasureScore = 75;
    } else {
      treasureScore = 50;
    }

    const finalScore = ratingScore * 0.30 + distanceScore * 0.30 + priceScore * 0.15 + infoScore * 0.15 + treasureScore * 0.10;
    const adjustedScore = applyFeedbackToScore(r, Math.round(finalScore));

    return { ...r, matchScore: adjustedScore };
  });

  scored.sort((a, b) => b.matchScore - a.matchScore);

  const poolSize = Math.min(5, scored.length);
  const topN = scored.slice(0, poolSize);

  if (topN.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * topN.length);
  const selected = topN[randomIndex];

  let displayRangeShort = '';
  let displayRangeDetail = '';
  if (mode === 'explore_near') {
    displayRangeShort = '1km内';
    displayRangeDetail = '1km内';
  } else if (mode === 'explore_mid') {
    displayRangeShort = '3km内';
    displayRangeDetail = '1-3km';
  } else if (mode === 'explore_far') {
    displayRangeShort = '5km内';
    displayRangeDetail = '3-5km';
  } else if (mode === 'explore_any') {
    displayRangeShort = '全城';
    displayRangeDetail = '全城';
  } else {
    displayRangeShort = `${(targetMaxMeters / 1000).toFixed(0)}km内`;
    displayRangeDetail = `${(targetMinMeters / 1000).toFixed(1)}-${(targetMaxMeters / 1000).toFixed(1)}km`;
  }

  const distanceText = selected.distance <= 5 ? '很近' : selected.distance <= 15 ? '距离适中' : '稍远';
  const exploreMessage = `发现一家${displayRangeShort}范围内的宝藏小店，评价不多但口碑很棒！`;

  return {
    ...selected,
    matchScore: selected.matchScore,
    reasons: [
      { type: 'match', text: `步行${selected.distance}分钟 — ${distanceText}` },
      { type: 'match', text: `探索发现：${displayRangeDetail} 范围内的宝藏店` }
    ],
    soloFriendly: calculateSoloFriendly(selected),
    exploreMessage,
  };
}

/**
 * 随机探索（多人/单人通用）
 */
export async function randomExplore(currentLocation, mode = EXPLORE_MODES.FRESH, members = [], excludeIds = []) {
  const now = new Date();
  const hour = now.getHours();

  let timeContext = '';
  let keyword = '餐厅';

  if (hour >= 6 && hour < 9) {
    timeContext = '早餐';
    keyword = '早餐';
  } else if (hour >= 11 && hour < 14) {
    timeContext = '午餐';
    keyword = '餐厅';
  } else if (hour >= 14 && hour < 17) {
    timeContext = '下午茶';
    keyword = '咖啡|甜品|奶茶';
  } else if (hour >= 17 && hour < 21) {
    timeContext = '晚餐';
    keyword = '餐厅';
  } else {
    timeContext = '夜宵';
    keyword = '夜宵|烧烤|火锅';
  }

  let recommendations = [];

  const realRestaurants = currentLocation ? await searchPOI(keyword, currentLocation, 5000) : null;

  if (realRestaurants && realRestaurants.length > 0) {
    recommendations = realRestaurants;
  } else {
    recommendations = mockRestaurants.filter(r => {
      if (timeContext === '下午茶') {
        return r.cuisine.includes('奶茶') || r.cuisine.includes('咖啡') || r.cuisine.includes('沙拉');
      }
      return true;
    });
    if (recommendations.length === 0) {
      recommendations = [...mockRestaurants];
    }
  }

  const applyExcludeFilter = (list) => {
    let filtered = list.filter(r => !isAlreadyExplored(r.id));
    if (excludeIds && excludeIds.length > 0) {
      filtered = filtered.filter(r => !excludeIds.includes(r.id));
    }
    return filtered;
  };

  recommendations = applyExcludeFilter(recommendations);

  if (recommendations.length === 0) {
    const fallbackList = realRestaurants && realRestaurants.length > 0
      ? realRestaurants
      : mockRestaurants;
    recommendations = applyExcludeFilter(fallbackList);
  }

  let restaurant;
  if (mode === EXPLORE_MODES.FRESH) {
    const mentionedCuisines = new Set();
    if (members && members.length > 0) {
      members.forEach(m => {
        if (!m.text) return;
        const text = m.text;
        for (const [cuisine, keywords] of Object.entries(CUISINE_KEYWORDS_FOR_FILTER)) {
          if (keywords.some(k => text.includes(k))) {
            mentionedCuisines.add(cuisine);
          }
        }
      });
    }

    let freshCandidates = recommendations;

    if (mentionedCuisines.size > 0) {
      freshCandidates = recommendations.filter(r => {
        const allText = [...(r.tags || []), ...(r.features || []), r.cuisine || ''].join('');
        return ![...mentionedCuisines].some(c => allText.includes(c));
      });
    }

    if (freshCandidates.length === 0) {
      freshCandidates = recommendations;
    }

    const scored = freshCandidates.map(r => {
      const rating = r.rating || 4.0;
      const groupScore = calculateGroupFriendly(r);
      const freshScore = (rating / 5) * 0.6 + (groupScore / 100) * 0.4;
      return { ...r, freshScore };
    });
    scored.sort((a, b) => b.freshScore - a.freshScore);

    const top5 = scored.slice(0, 5);
    restaurant = top5[Math.floor(Math.random() * top5.length)];
  }

  const { score, reasons } = calculateSingleScore(restaurant, {
    preferences: [],
    allergies: [],
    budget: null,
    atmosphere: '',
  });

  addToExploreHistory(restaurant);

  const exploreMessage = getExploreMessage(mode, restaurant, timeContext);
  const story = getRestaurantStory(restaurant, mode);

  return {
    ...restaurant,
    matchScore: score,
    reasons,
    exploreMessage,
    timeContext,
    exploreMode: mode,
    story,
  };
}

export function getExploreModes() {
  return {
    [EXPLORE_MODES.FRESH]: { label: '尝鲜体验', icon: '🌟', description: '跳出大家提到的菜系，推荐高评价新口味' },
  };
}

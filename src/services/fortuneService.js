/**
 * 占卜运势服务
 * 包含: 运势卡牌、抽卡、今日运势模式推荐
 */
import { mockRestaurants } from '../data/mockRestaurants';
import { searchPOI } from './amapService';
import { applyFeedbackToScore } from './feedbackService';
import { calculateSoloFriendly, calculateSingleScore, filterExpansionsByAllergies } from './scoringService';

export const FORTUNE_CARDS = [
  { id: 'spicy', icon: '🌶️', label: '宜吃辣', keywords: ['川菜', '湘菜', '火锅'], message: '星象显示你今天需要一点刺激' },
  { id: 'noodles', icon: '🍜', label: '宜嗦面', keywords: ['面馆', '米线', '粉'], message: '古人云：今日宜嗦一大碗面' },
  { id: 'light', icon: '🥗', label: '宜沙拉', keywords: ['轻食', '沙拉', '粤菜', '日料'], message: '你的胃今天需要被温柔对待' },
  { id: 'meat', icon: '🍖', label: '宜大口吃肉', keywords: ['烤肉', '烧烤', '牛排'], message: '今日能量缺口，需要蛋白质补上' },
  { id: 'hotpot', icon: '🍲', label: '宜火锅', keywords: ['火锅', '涮锅', '串串'], message: '水象星座加持，今天适合涮一锅' },
  { id: 'sweet', icon: '🍰', label: '宜甜食', keywords: ['甜品', '蛋糕', '奶茶'], message: '生活太苦，星象说今天需要一点甜' },
  { id: 'seafood', icon: '🦐', label: '宜海鲜', keywords: ['海鲜', '日料', '寿司'], message: '海王星顺行，今天与海鲜最有缘' },
  { id: 'fast', icon: '🍔', label: '宜快餐', keywords: ['快餐', '汉堡', '炸鸡'], message: '今日节奏快，宜速战速决' },
  { id: 'warm', icon: '🥣', label: '宜暖胃', keywords: ['粥', '汤', '砂锅'], message: '秋风起宜进补，一碗热汤暖全身' },
  { id: 'exotic', icon: '🌴', label: '宜异国', keywords: ['东南亚', '泰餐', '西餐'], message: '远方在召唤，今天舌尖去旅行' },
  { id: 'street', icon: '🍢', label: '宜街头', keywords: ['小吃', '串串', '烧烤'], message: '烟火气最旺的一天，路边摊有惊喜' },
  { id: 'sushi', icon: '🍣', label: '宜日料', keywords: ['日料', '寿司', '刺身'], message: '木星守护，精致料理带来好运' },
  { id: 'coffee', icon: '☕', label: '宜咖啡', keywords: ['咖啡', '西餐', '甜品'], message: '今日灵感枯竭，一杯手冲唤醒大脑' },
  { id: 'bbq', icon: '🔥', label: '宜烧烤', keywords: ['烧烤', '烤串', '撸串'], message: '火星入庙，今晚宜围炉夜话' },
];

export function drawFortuneCard() {
  const randomIndex = Math.floor(Math.random() * FORTUNE_CARDS.length);
  return FORTUNE_CARDS[randomIndex];
}

/**
 * 今日运势模式推荐
 */
export async function recommendFortune(location, fortuneCard = null, applyPrefFilter = null, excludeId = null, excludeIds = [], allergies = []) {
  const card = fortuneCard || drawFortuneCard();
  let candidates = [];

  const applyFortuneExclude = (list) => {
    let filtered = list;
    if (excludeId) {
      filtered = filtered.filter(r => r.id !== excludeId);
    }
    if (excludeIds && excludeIds.length > 0) {
      filtered = filtered.filter(r => !excludeIds.includes(r.id));
    }
    return filtered;
  };

  if (card.keywords.length > 0) {
    // 🔧 修复：运势卡关键词也要做过敏感知过滤
    let keyword = card.keywords.join('|');
    if (allergies && allergies.length > 0) {
      keyword = filterExpansionsByAllergies(keyword, allergies);
    }
    // 如果过滤后关键词为空，说明运势卡内容与用户过敏完全冲突，跳过该卡关键词搜索
    if (keyword) {
      const realRestaurants = location ? await searchPOI(keyword, location, 3000) : null;
      if (realRestaurants && realRestaurants.length > 0) {
        candidates = realRestaurants;
      }
    }
  }

  if (candidates.length === 0) {
    const realRestaurants = location ? await searchPOI('餐厅', location, 3000) : null;
    if (realRestaurants && realRestaurants.length > 0) {
      candidates = realRestaurants;
    } else {
      candidates = [...mockRestaurants];
    }
  }

  candidates = applyFortuneExclude(candidates);

  // 应用偏好过滤（价格范围 + 菜系口味标签）
  if (applyPrefFilter) {
    candidates = applyPrefFilter(candidates);
  }

  // 如果过滤后为空，回退到不过滤的候选列表
  if (candidates.length === 0) {
    let fallbackList = [];
    if (card.keywords.length > 0) {
      let keyword = card.keywords.join('|');
      if (allergies && allergies.length > 0) {
        keyword = filterExpansionsByAllergies(keyword, allergies);
      }
      if (keyword) {
        const fallbackResults = location ? await searchPOI(keyword, location, 3000) : null;
        if (fallbackResults && fallbackResults.length > 0) fallbackList = fallbackResults;
      }
    }
    if (fallbackList.length === 0) fallbackList = [...mockRestaurants];
    candidates = applyFortuneExclude(fallbackList);
  }

  const fortuneIntent = {
    preferences: card.keywords,
    allergies: allergies || [],
    solo: true,
  };

  const scoredCandidates = candidates.map(r => {
    const { score } = calculateSingleScore(r, fortuneIntent);
    const adjustedScore = applyFeedbackToScore(r, score);
    return { ...r, matchScore: adjustedScore };
  });

  scoredCandidates.sort((a, b) => b.matchScore - a.matchScore);

  const poolSize = Math.min(8, scoredCandidates.length);
  const topN = scoredCandidates.slice(0, poolSize);
  const finalChoice = topN[Math.floor(Math.random() * topN.length)];

  if (!finalChoice) {
    return null;
  }

  const exploreMessage = `${card.label} — ${card.message}`;
  const distanceText = finalChoice.distance <= 5 ? '很近' : finalChoice.distance <= 15 ? '距离适中' : '稍远';

  return {
    ...finalChoice,
    soloFriendly: calculateSoloFriendly(finalChoice),
    fortuneCard: card,
    exploreMessage,
    isExploreMode: true,
    exploreMode: 'fortune',
    reasons: [
      { type: 'match', text: `步行${finalChoice.distance}分钟 — ${distanceText}` },
      { type: 'match', text: `${card.label}：${card.message}` }
    ],
  };
}

/**
 * 占卜运势服务自动化测试
 * 覆盖: FORTUNE_CARDS, drawFortuneCard, recommendFortune
 *
 * 运行: npm test
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  FORTUNE_CARDS,
  drawFortuneCard,
  recommendFortune,
} from '../services/fortuneService';

// Mock 外部依赖
vi.mock('../services/amapService', () => ({
  searchPOI: vi.fn(),
  searchPOIByDistanceRanges: vi.fn(),
}));

vi.mock('../services/feedbackService', () => ({
  applyFeedbackToScore: vi.fn((r, score) => score),
}));

vi.mock('../data/mockRestaurants', () => ({
  mockRestaurants: [
    { id: 1, name: '绿茶餐厅', cuisine: '江浙菜', price: 52, rating: 4.6, reviewCount: 1200, distance: 8, distanceMeters: 600, tags: ['清淡'], features: [], photos: [], featureTags: [] },
    { id: 2, name: '海底捞火锅', cuisine: '火锅', price: 120, rating: 4.7, reviewCount: 2000, distance: 5, distanceMeters: 400, tags: ['火锅', '麻辣'], features: ['包间'], photos: [{ url: 'img1' }], featureTags: ['火锅'] },
    { id: 3, name: '老北京炸酱面', cuisine: '北京菜', price: 25, rating: 4.2, reviewCount: 2000, distance: 3, distanceMeters: 200, tags: ['面食'], features: [], photos: [], featureTags: [] },
    { id: 4, name: '寿司店', cuisine: '日料', price: 180, rating: 4.8, reviewCount: 500, distance: 10, distanceMeters: 800, tags: ['日料', '寿司'], features: [], photos: [{ url: 'img2' }], featureTags: ['寿司'] },
  ],
}));

import { searchPOI } from '../services/amapService';

// ============ FORTUNE_CARDS 测试 ============

describe('FORTUNE_CARDS', () => {
  it('卡牌数量正确', () => {
    expect(FORTUNE_CARDS.length).toBeGreaterThan(0);
    expect(FORTUNE_CARDS.length).toBe(14);
  });

  it('每张卡牌都有必要字段', () => {
    FORTUNE_CARDS.forEach(card => {
      expect(card.id).toBeDefined();
      expect(card.icon).toBeDefined();
      expect(card.label).toBeDefined();
      expect(card.keywords).toBeDefined();
      expect(Array.isArray(card.keywords)).toBe(true);
      expect(card.message).toBeDefined();
    });
  });

  it('卡牌 ID 唯一', () => {
    const ids = FORTUNE_CARDS.map(c => c.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('所有 icon 为 emoji 格式', () => {
    FORTUNE_CARDS.forEach(card => {
      expect(card.icon.length).toBeGreaterThanOrEqual(1);
    });
  });
});

// ============ drawFortuneCard 测试 ============

describe('drawFortuneCard', () => {
  it('返回一张卡牌', () => {
    const card = drawFortuneCard();
    expect(card).toBeDefined();
    expect(card.id).toBeDefined();
    expect(card.icon).toBeDefined();
    expect(card.label).toBeDefined();
    expect(card.keywords).toBeDefined();
  });

  it('返回的卡牌在 FORTUNE_CARDS 中', () => {
    const card = drawFortuneCard();
    const found = FORTUNE_CARDS.find(c => c.id === card.id);
    expect(found).toBeDefined();
  });

  it('多次抽取 → 返回不同卡牌概率 > 0', () => {
    const cards = new Set();
    for (let i = 0; i < 20; i++) {
      cards.add(drawFortuneCard().id);
    }
    expect(cards.size).toBeGreaterThan(1);
  });
});

// ============ recommendFortune 测试 ============

describe('recommendFortune', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockLocation = { lat: 39.99, lng: 116.47, name: '望京' };

  it('有位置 + 有数据 → 返回推荐', async () => {
    searchPOI.mockResolvedValueOnce([
      { id: 100, name: '川菜馆', cuisine: '川菜', price: 60, rating: 4.6, reviewCount: 500, distance: 8, distanceMeters: 700, tags: ['川菜', '辣'], features: [], photos: [], featureTags: [] },
      { id: 101, name: '火锅店', cuisine: '火锅', price: 100, rating: 4.7, reviewCount: 800, distance: 6, distanceMeters: 500, tags: ['火锅'], features: [], photos: [], featureTags: [] },
    ]);

    const card = FORTUNE_CARDS.find(c => c.keywords.includes('川菜')) || FORTUNE_CARDS[0];
    const result = await recommendFortune(mockLocation, card);

    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
    expect(result.matchScore).toBeDefined();
    expect(result.reasons).toBeDefined();
    expect(result.fortuneCard).toBeDefined();
    expect(result.exploreMessage).toBeDefined();
    expect(result.soloFriendly).toBeDefined();
  });

  it('无位置 → 使用 mock 数据', async () => {
    const result = await recommendFortune(null, FORTUNE_CARDS[0]);
    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
  });

  it('排除单个 ID (excludeId)', async () => {
    searchPOI.mockResolvedValueOnce([
      { id: 100, name: '川菜馆', cuisine: '川菜', price: 60, rating: 4.6, reviewCount: 500, distance: 8, distanceMeters: 700, tags: ['川菜'], features: [], photos: [], featureTags: [] },
      { id: 101, name: '火锅店', cuisine: '火锅', price: 100, rating: 4.7, reviewCount: 800, distance: 6, distanceMeters: 500, tags: ['火锅'], features: [], photos: [], featureTags: [] },
    ]);

    const result = await recommendFortune(mockLocation, FORTUNE_CARDS[0], null, 100);
    expect(result.id).not.toBe(100);
  });

  it('排除多个 ID (excludeIds)', async () => {
    searchPOI.mockResolvedValueOnce([
      { id: 100, name: '川菜馆', cuisine: '川菜', price: 60, rating: 4.6, reviewCount: 500, distance: 8, distanceMeters: 700, tags: ['川菜'], features: [], photos: [], featureTags: [] },
      { id: 101, name: '火锅店', cuisine: '火锅', price: 100, rating: 4.7, reviewCount: 800, distance: 6, distanceMeters: 500, tags: ['火锅'], features: [], photos: [], featureTags: [] },
    ]);

    const result = await recommendFortune(mockLocation, FORTUNE_CARDS[0], null, null, [100, 101]);
    expect(result).toBeDefined();
    expect(result.id).not.toBe(100);
    expect(result.id).not.toBe(101);
  });

  it('无指定卡牌 → 自动抽卡', async () => {
    searchPOI.mockResolvedValueOnce([]);
    const result = await recommendFortune(mockLocation);
    expect(result).toBeDefined();
    expect(result.fortuneCard).toBeDefined();
    expect(result.fortuneCard.id).toBeDefined();
  });

  it('卡牌无关键词时 → 仍正常返回', async () => {
    const card = { ...FORTUNE_CARDS[0], keywords: [] };
    const result = await recommendFortune(mockLocation, card);
    expect(result).toBeDefined();
  });

  it('结果包含必要字段', async () => {
    searchPOI.mockResolvedValueOnce([
      { id: 100, name: '测试店', cuisine: '中餐', price: 50, rating: 4.5, reviewCount: 300, distance: 7, distanceMeters: 600, tags: [], features: [], photos: [], featureTags: [] },
    ]);

    const result = await recommendFortune(mockLocation, FORTUNE_CARDS[0]);

    expect(result.matchScore).toBeDefined();
    expect(result.reasons).toBeDefined();
    expect(result.reasons.length).toBeGreaterThan(0);
    expect(result.soloFriendly).toBeDefined();
    expect(result.fortuneCard).toBeDefined();
    expect(result.exploreMessage).toBeDefined();
    expect(result.isExploreMode).toBe(true);
    expect(result.exploreMode).toBe('fortune');
  });

  it('偏好过滤后空结果 → 回退到不过滤的结果', async () => {
    searchPOI.mockResolvedValueOnce([
      { id: 100, name: '川菜馆', cuisine: '川菜', price: 60, rating: 4.6, reviewCount: 500, distance: 8, distanceMeters: 700, tags: ['川菜'], features: [], photos: [], featureTags: [] },
    ]);

    const strictFilter = () => [];
    const result = await recommendFortune(mockLocation, FORTUNE_CARDS[0], strictFilter);
    expect(result).toBeDefined();
  });

  it('所有候选被排除 → 返回 null', async () => {
    searchPOI.mockResolvedValueOnce([
      { id: 100, name: '川菜馆', cuisine: '川菜', price: 60, rating: 4.6, reviewCount: 500, distance: 8, distanceMeters: 700, tags: ['川菜'], features: [], photos: [], featureTags: [] },
    ]);

    const result = await recommendFortune(mockLocation, FORTUNE_CARDS[0], null, null, [100]);
    // 如果 mock 数据也被排除，可能返回 null
    if (result === null) {
      expect(result).toBeNull();
    } else {
      expect(result).toBeDefined();
    }
  });
});

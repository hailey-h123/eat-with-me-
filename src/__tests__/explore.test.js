/**
 * 探索模式服务自动化测试
 * 覆盖: calculateGroupFriendly, 探索历史管理, getExploreModes,
 *       exploreHiddenTreasures, randomExplore
 *
 * 运行: npm test
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  calculateGroupFriendly,
  getExploreHistory,
  addToExploreHistory,
  isAlreadyExplored,
  getExploreModes,
  exploreHiddenTreasures,
  randomExplore,
} from '../services/exploreService';

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
    { id: 2, name: '鲜茶语', cuisine: '奶茶甜品', price: 28, rating: 4.8, reviewCount: 800, distance: 5, distanceMeters: 400, tags: ['甜品'], features: [], photos: [{ url: 'img1' }], featureTags: ['甜品'] },
    { id: 3, name: '云南米线', cuisine: '云南菜', price: 38, rating: 4.4, reviewCount: 600, distance: 12, distanceMeters: 900, tags: ['热汤'], features: [], photos: [], featureTags: [] },
    { id: 4, name: '炸酱面', cuisine: '北京菜', price: 25, rating: 4.2, reviewCount: 2000, distance: 3, distanceMeters: 200, tags: ['面食'], features: [], photos: [], featureTags: [] },
  ],
}));

import { searchPOI, searchPOIByDistanceRanges } from '../services/amapService';

const EXPLORE_HISTORY_KEY = 'eatwithme_explore_history';

// ============ 测试数据 ============

const hotpotRestaurant = {
  id: 'test-hotpot',
  name: '海底捞火锅',
  cuisine: '火锅',
  tags: ['火锅', '麻辣'],
  features: ['包间', '大桌'],
  price: 120,
  rating: 4.5,
  reviewCount: 1000,
  distance: 10,
};

const bbqRestaurant = {
  id: 'test-bbq',
  name: '韩式烤肉店',
  cuisine: '烤肉',
  tags: ['烤肉', '烧烤'],
  features: ['包间'],
  price: 150,
  rating: 4.3,
  reviewCount: 500,
  distance: 15,
};

const barRestaurant = {
  id: 'test-bar',
  name: '酒吧餐吧',
  cuisine: '西餐',
  tags: ['酒吧', '吧台'],
  features: ['吧台', '单人座'],
  price: 200,
  rating: 4.2,
  reviewCount: 300,
  distance: 5,
};

const normalRestaurant = {
  id: 'test-normal',
  name: '普通中餐馆',
  cuisine: '中餐',
  tags: ['中餐'],
  features: [],
  price: 80,
  rating: 4.0,
  reviewCount: 200,
  distance: 8,
};

// ============ calculateGroupFriendly 测试 ============

describe('calculateGroupFriendly', () => {
  it('火锅店（有包间）→ 高分（>=75）', () => {
    const score = calculateGroupFriendly(hotpotRestaurant);
    expect(score).toBeGreaterThanOrEqual(75);
  });

  it('烤肉店（有包间）→ 高分（>=75）', () => {
    const score = calculateGroupFriendly(bbqRestaurant);
    expect(score).toBeGreaterThanOrEqual(75);
  });

  it('吧台/单人座餐厅 → 低分（<50）', () => {
    const score = calculateGroupFriendly(barRestaurant);
    expect(score).toBeLessThan(50);
  });

  it('普通餐厅 → 中等分（50左右）', () => {
    const score = calculateGroupFriendly(normalRestaurant);
    expect(score).toBeGreaterThanOrEqual(40);
    expect(score).toBeLessThanOrEqual(60);
  });

  it('分数范围限制在 [0, 100]', () => {
    // 测试极端高分场景
    const allFeatures = {
      ...hotpotRestaurant,
      tags: ['火锅', '烧烤', '烤肉', '自助', '自助'],
      features: ['包间', '大桌', '包厢'],
    };
    const highScore = calculateGroupFriendly(allFeatures);
    expect(highScore).toBeLessThanOrEqual(100);

    // 测试极端低分场景
    const allBar = {
      ...barRestaurant,
      tags: ['吧台', '吧台', '单人', '单人'],
      features: ['吧台', '单人', '单人座'],
    };
    const lowScore = calculateGroupFriendly(allBar);
    expect(lowScore).toBeGreaterThanOrEqual(0);
  });

  it('空 tags 和 features → 返回基础分 50', () => {
    const emptyRestaurant = {
      id: 'test-empty',
      name: '无标签餐厅',
      cuisine: '',
      tags: [],
      features: [],
    };
    const score = calculateGroupFriendly(emptyRestaurant);
    expect(score).toBe(50);
  });

  it('tags 和 features 为 undefined → 不报错，返回基础分', () => {
    const undefinedRestaurant = {
      id: 'test-undefined',
      name: 'undefined餐厅',
      cuisine: '中餐',
    };
    const score = calculateGroupFriendly(undefinedRestaurant);
    expect(score).toBe(50);
  });
});

// ============ 探索历史管理测试 ============

describe('探索历史管理', () => {
  beforeEach(() => {
    // 每个测试前清空 localStorage
    localStorage.removeItem(EXPLORE_HISTORY_KEY);
  });

  it('初始状态 → 历史为空数组', () => {
    const history = getExploreHistory();
    expect(history).toEqual([]);
  });

  it('添加记录后 → 能获取到', () => {
    addToExploreHistory(hotpotRestaurant);
    const history = getExploreHistory();
    expect(history.length).toBe(1);
    expect(history[0].id).toBe('test-hotpot');
    expect(history[0].name).toBe('海底捞火锅');
    expect(history[0].timestamp).toBeDefined();
  });

  it('添加多条记录 → 新记录在最前', () => {
    addToExploreHistory(hotpotRestaurant);
    addToExploreHistory(bbqRestaurant);
    const history = getExploreHistory();
    expect(history.length).toBe(2);
    expect(history[0].id).toBe('test-bbq'); // 后添加的在最前
    expect(history[1].id).toBe('test-hotpot');
  });

  it('添加超过20条 → 自动截断到20条', () => {
    for (let i = 0; i < 25; i++) {
      addToExploreHistory({ id: `test-${i}`, name: `餐厅${i}`, timestamp: Date.now() });
    }
    const history = getExploreHistory();
    expect(history.length).toBe(20);
    // 最新的记录应该保留
    expect(history[0].id).toBe('test-24');
  });

  it('已探索的餐厅 → isAlreadyExplored 返回 true', () => {
    addToExploreHistory(hotpotRestaurant);
    expect(isAlreadyExplored('test-hotpot')).toBe(true);
  });

  it('未探索的餐厅 → isAlreadyExplored 返回 false', () => {
    expect(isAlreadyExplored('test-unknown')).toBe(false);
  });

  it('清除历史后 → isAlreadyExplored 返回 false', () => {
    addToExploreHistory(hotpotRestaurant);
    localStorage.removeItem(EXPLORE_HISTORY_KEY);
    expect(isAlreadyExplored('test-hotpot')).toBe(false);
  });
});

// ============ getExploreModes 测试 ============

describe('getExploreModes', () => {
  it('返回探索模式配置', () => {
    const modes = getExploreModes();
    expect(modes).toBeDefined();
    expect(modes.fresh).toBeDefined();
    expect(modes.fresh.label).toBe('尝鲜体验');
    expect(modes.fresh.icon).toBe('🌟');
  });

  it('尝鲜模式有描述', () => {
    const modes = getExploreModes();
    expect(modes.fresh.description.length).toBeGreaterThan(0);
  });
});

// ============ exploreHiddenTreasures 测试 ============

describe('exploreHiddenTreasures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.removeItem(EXPLORE_HISTORY_KEY);
  });

  const mockLocation = { lat: 39.99, lng: 116.47, name: '望京' };

  it('有真实餐厅数据 → 返回评分餐厅', async () => {
    searchPOIByDistanceRanges.mockResolvedValueOnce([
      { id: 100, name: '宝藏小店', cuisine: '家常菜', price: 45, rating: 4.7, reviewCount: 200, distance: 6, distanceMeters: 500, tags: ['家常'], features: [], photos: [], featureTags: [] },
      { id: 101, name: '另一家', cuisine: '川菜', price: 60, rating: 4.5, reviewCount: 100, distance: 7, distanceMeters: 600, tags: ['川菜'], features: [], photos: [], featureTags: [] },
    ]);

    const result = await exploreHiddenTreasures(mockLocation, 1000);

    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
    expect(result.matchScore).toBeDefined();
    expect(result.reasons).toBeDefined();
    expect(result.soloFriendly).toBeDefined();
    expect(result.exploreMessage).toBeDefined();
  });

  it('空结果 → 回退到 mock 数据', async () => {
    searchPOIByDistanceRanges.mockResolvedValueOnce([]);
    searchPOI.mockResolvedValueOnce([]);

    const result = await exploreHiddenTreasures(mockLocation, 1000);

    expect(result).toBeDefined();
    expect(result.isMock).toBe(true);
  });

  it('radius <= 500m → 搜索距离范围 100-500m', async () => {
    searchPOIByDistanceRanges.mockResolvedValueOnce([]);
    searchPOI.mockResolvedValueOnce([]);

    const result = await exploreHiddenTreasures(mockLocation, 500);
    expect(result).toBeDefined();
  });

  it('radius <= 1km → 搜索距离范围 500-1000m', async () => {
    searchPOIByDistanceRanges.mockResolvedValueOnce([]);
    searchPOI.mockResolvedValueOnce([]);

    const result = await exploreHiddenTreasures(mockLocation, 1000);
    expect(result).toBeDefined();
  });

  it('radius <= 3km → 搜索距离范围 1000-3000m', async () => {
    searchPOIByDistanceRanges.mockResolvedValueOnce([]);
    searchPOI.mockResolvedValueOnce([]);

    const result = await exploreHiddenTreasures(mockLocation, 3000);
    expect(result).toBeDefined();
  });

  it('excludeIds → 排除指定餐厅', async () => {
    searchPOIByDistanceRanges.mockResolvedValueOnce([
      { id: 100, name: '宝藏1', cuisine: '家常菜', price: 45, rating: 4.7, reviewCount: 200, distance: 6, distanceMeters: 500, tags: [], features: [], photos: [], featureTags: [] },
      { id: 101, name: '宝藏2', cuisine: '川菜', price: 60, rating: 4.5, reviewCount: 100, distance: 7, distanceMeters: 600, tags: [], features: [], photos: [], featureTags: [] },
    ]);

    const result = await exploreHiddenTreasures(mockLocation, 1000, null, null, [100]);

    expect(result.id).not.toBe(100);
  });

  it('mode=explore_near → 显示 1km内', async () => {
    searchPOIByDistanceRanges.mockResolvedValueOnce([
      { id: 100, name: '宝藏', cuisine: '家常菜', price: 45, rating: 4.7, reviewCount: 200, distance: 6, distanceMeters: 500, tags: [], features: [], photos: [], featureTags: [] },
    ]);

    const result = await exploreHiddenTreasures(mockLocation, 1000, null, 'explore_near');
    expect(result.exploreMessage).toContain('1km内');
  });

  it('无 location → 使用 mock 数据', async () => {
    const result = await exploreHiddenTreasures(null, 1000);
    expect(result).toBeDefined();
  });

  it('评分: 隐藏宝藏条件 (reviewCount < 500 && rating >= 4.0)', async () => {
    searchPOIByDistanceRanges.mockResolvedValueOnce([
      { id: 200, name: '宝藏', cuisine: '家常菜', price: 45, rating: 4.7, reviewCount: 300, distance: 6, distanceMeters: 500, tags: [], features: [], photos: [], featureTags: [] },
      { id: 201, name: '高人气', cuisine: '川菜', price: 60, rating: 4.8, reviewCount: 1000, distance: 7, distanceMeters: 600, tags: [], features: [], photos: [], featureTags: [] },
    ]);

    const result = await exploreHiddenTreasures(mockLocation, 1000);
    expect(result).toBeDefined();
  });
});

// ============ randomExplore 测试 ============

describe('randomExplore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.removeItem(EXPLORE_HISTORY_KEY);
  });

  const mockLocation = { lat: 39.99, lng: 116.47, name: '望京' };

  it('有真实数据 → 返回随机推荐', async () => {
    searchPOI.mockResolvedValueOnce([
      { id: 300, name: '推荐1', cuisine: '川菜', price: 60, rating: 4.6, reviewCount: 500, distance: 8, distanceMeters: 700, tags: ['辣'], features: [], photos: [], featureTags: [] },
      { id: 301, name: '推荐2', cuisine: '日料', price: 100, rating: 4.5, reviewCount: 300, distance: 10, distanceMeters: 800, tags: ['日料'], features: [], photos: [], featureTags: [] },
    ]);

    const result = await randomExplore(mockLocation);

    expect(result).toBeDefined();
    expect(result.matchScore).toBeDefined();
    expect(result.reasons).toBeDefined();
    expect(result.exploreMessage).toBeDefined();
    expect(result.story).toBeDefined();
    expect(result.timeContext).toBeDefined();
  });

  it('无真实数据 → 使用 mock 数据', async () => {
    searchPOI.mockResolvedValueOnce([]);

    const result = await randomExplore(mockLocation);
    expect(result).toBeDefined();
  });

  it('excludeIds → 排除已推荐餐厅', async () => {
    searchPOI.mockResolvedValueOnce([
      { id: 300, name: '推荐1', cuisine: '川菜', price: 60, rating: 4.6, reviewCount: 500, distance: 8, distanceMeters: 700, tags: ['辣'], features: [], photos: [], featureTags: [] },
      { id: 301, name: '推荐2', cuisine: '日料', price: 100, rating: 4.5, reviewCount: 300, distance: 10, distanceMeters: 800, tags: ['日料'], features: [], photos: [], featureTags: [] },
    ]);

    const result = await randomExplore(mockLocation, 'fresh', [], [300]);
    expect(result.id).not.toBe(300);
  });

  it('尝鲜模式: 排除成员提到的菜系', async () => {
    searchPOI.mockResolvedValueOnce([
      { id: 300, name: '川菜馆', cuisine: '川菜', price: 60, rating: 4.6, reviewCount: 500, distance: 8, distanceMeters: 700, tags: ['川菜'], features: [], photos: [], featureTags: [] },
      { id: 301, name: '日料店', cuisine: '日料', price: 100, rating: 4.5, reviewCount: 300, distance: 10, distanceMeters: 800, tags: ['日料'], features: [], photos: [], featureTags: [] },
    ]);

    const members = [{ name: 'A', text: '想吃川菜' }];
    const result = await randomExplore(mockLocation, 'fresh', members);
    expect(result).toBeDefined();
  });

  it('无 location → 使用 mock 数据', async () => {
    const result = await randomExplore(null);
    expect(result).toBeDefined();
  });

  it('结果包含 exploreMode 和 story', async () => {
    searchPOI.mockResolvedValueOnce([
      { id: 300, name: '推荐1', cuisine: '川菜', price: 60, rating: 4.6, reviewCount: 500, distance: 8, distanceMeters: 700, tags: ['辣'], features: [], photos: [], featureTags: [] },
    ]);

    const result = await randomExplore(mockLocation);
    expect(result.exploreMode).toBe('fresh');
    expect(typeof result.story).toBe('string');
    expect(result.story.length).toBeGreaterThan(0);
  });
});
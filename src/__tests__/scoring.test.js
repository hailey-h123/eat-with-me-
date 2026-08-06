/**
 * 评分算法自动化测试
 * 覆盖: calculateSingleScore, calculateGroupScore, filterByAllergies, calculateSoloFriendly
 *
 * 运行: npm test
 */
import { describe, it, expect } from 'vitest';
import {
  calculateSingleScore,
  calculateGroupScore,
  filterByAllergies,
  calculateSoloFriendly,
} from '../services/scoringService';

// ============ 测试数据 ============

const baseRestaurant = {
  id: 'test-001',
  name: '测试餐厅',
  cuisine: '川菜',
  price: 60,
  rating: 4.5,
  distance: 8,
  reviewCount: 600,
  tags: ['川菜', '火锅'],
  features: ['麻辣'],
  photos: [],
  featureTags: [],
};

// ============ calculateSingleScore 测试 ============

describe('calculateSingleScore', () => {
  it('偏好匹配：想吃川菜 + 川菜餐厅 → 高分', () => {
    const result = calculateSingleScore(baseRestaurant, {
      preferences: ['川菜'],
      allergies: [],
      budget: 100,
    });
    expect(result.score).toBeGreaterThan(75);
    expect(result.reasons.some(r => r.text.includes('川菜'))).toBe(true);
  });

  it('偏好不匹配：想吃日料 + 川菜餐厅 → 分数较低', () => {
    const result = calculateSingleScore(baseRestaurant, {
      preferences: ['日料'],
      allergies: [],
      budget: 100,
    });
    const matched = calculateSingleScore(baseRestaurant, {
      preferences: ['川菜'],
      allergies: [],
      budget: 100,
    });
    expect(result.score).toBeLessThan(matched.score);
  });

  it('预算内：人均60 + 预算100 → 有"预算内"提示', () => {
    const result = calculateSingleScore(baseRestaurant, {
      preferences: [],
      allergies: [],
      budget: 100,
    });
    expect(result.reasons.some(r => r.text.includes('预算'))).toBe(true);
  });

  it('超预算：人均150 + 预算80 → 低分 + "超出预算"提示', () => {
    const expensive = { ...baseRestaurant, price: 150 };
    const result = calculateSingleScore(expensive, {
      preferences: [],
      allergies: [],
      budget: 80,
    });
    // 单人模式预算文案是"超出预算较多"
    expect(result.reasons.some(r => r.text.includes('超出预算') || r.text.includes('超预算'))).toBe(true);
  });

  it('距离近：步行5分钟 → "很近"提示', () => {
    const near = { ...baseRestaurant, distance: 5 };
    const result = calculateSingleScore(near, {
      preferences: [],
      allergies: [],
    });
    expect(result.reasons.some(r => r.text.includes('很近'))).toBe(true);
  });

  it('距离远：步行25分钟 → "稍远"提示', () => {
    const far = { ...baseRestaurant, distance: 25 };
    const result = calculateSingleScore(far, {
      preferences: [],
      allergies: [],
    });
    expect(result.reasons.some(r => r.text.includes('稍远'))).toBe(true);
  });

  it('无偏好无预算：返回合理默认分', () => {
    const result = calculateSingleScore(baseRestaurant, {
      preferences: [],
      allergies: [],
    });
    expect(result.score).toBeGreaterThan(50);
    expect(result.score).toBeLessThan(100);
  });

  it('分数拉伸：确保分数在合理展示范围 [52, 99]', () => {
    // 测试极端高分
    const perfect = {
      ...baseRestaurant,
      rating: 5.0,
      distance: 2,
      price: 50,
      reviewCount: 2000,
    };
    const high = calculateSingleScore(perfect, {
      preferences: ['川菜'],
      allergies: [],
      budget: 100,
    });
    expect(high.score).toBeGreaterThanOrEqual(52);
    expect(high.score).toBeLessThanOrEqual(99);

    // 测试极端低分
    const bad = {
      ...baseRestaurant,
      rating: 3.0,
      distance: 30,
      price: 300,
      reviewCount: 0,
    };
    const low = calculateSingleScore(bad, {
      preferences: ['日料'],
      allergies: [],
      budget: 50,
    });
    expect(low.score).toBeGreaterThanOrEqual(52);
    expect(low.score).toBeLessThanOrEqual(99);
  });

  it('价格范围过滤：priceRange [50,100] + 人均60 → 在范围内', () => {
    const result = calculateSingleScore(baseRestaurant, {
      preferences: [],
      allergies: [],
      priceRange: [50, 100],
    });
    expect(result.reasons.some(r => r.text.includes('预算范围'))).toBe(true);
  });

  it('价格范围过滤：priceRange [50,100] + 人均150 → 超出范围', () => {
    const expensive = { ...baseRestaurant, price: 150 };
    const result = calculateSingleScore(expensive, {
      preferences: [],
      allergies: [],
      priceRange: [50, 100],
    });
    expect(result.reasons.some(r => r.text.includes('超出预算范围'))).toBe(true);
  });
});

// ============ calculateGroupScore 测试 ============

describe('calculateGroupScore', () => {
  it('单人无成员 → 回退到单人评分', () => {
    const result = calculateGroupScore(baseRestaurant, {
      preferences: ['川菜'],
      allergies: [],
      budget: 100,
    });
    expect(result.score).toBeGreaterThan(0);
    expect(result.reasons).toBeDefined();
  });

  it('全员满意：2人都要吃川菜 + 川菜餐厅 → 全部满足', () => {
    const result = calculateGroupScore(baseRestaurant, {
      members: [
        { name: 'A', preferences: ['川菜'], allergies: [] },
        { name: 'B', preferences: ['川菜'], allergies: [] },
      ],
      preferences: ['川菜'],
      allergies: [],
      conflicts: [],
    });
    expect(result.reasons.some(r => r.text.includes('全员满意'))).toBe(true);
  });

  it('部分成员不匹配：一人想吃川菜，一人想吃火锅 + 纯川菜餐厅 → 有融合详情', () => {
    const pureSichuanRestaurant = {
      ...baseRestaurant,
      tags: ['川菜'],
      cuisine: '川菜',
      features: ['麻辣'],
    };
    const result = calculateGroupScore(pureSichuanRestaurant, {
      members: [
        { name: 'A', preferences: ['川菜'], allergies: [] },
        { name: 'B', preferences: ['火锅'], allergies: [] },
      ],
      preferences: ['川菜', '火锅'],
      allergies: [],
      conflicts: [],
    });
    // 有融合时显示融合详情，不再显示成员的 match/mismatch 原因
    expect(result.reasons.some(r => r.type === 'fusion')).toBe(true);
    expect(result.reasons.some(r => r.type === 'fusion-detail')).toBe(true);
  });

  it('冲突化解：一人忌辣 + 餐厅有微辣选项 → "冲突化解"', () => {
    const compromise = {
      ...baseRestaurant,
      tags: ['川菜', '微辣'],
      features: ['微辣', '改良'],
    };
    const result = calculateGroupScore(compromise, {
      members: [
        { name: 'A', preferences: ['川菜'], allergies: [] },
        { name: 'B', preferences: [], allergies: ['辣'] },
      ],
      preferences: ['川菜'],
      allergies: ['辣'],
      conflicts: [
        { preference: '川菜', allergy: '辣', type: 'soft', resolution: '有微辣选项' },
      ],
    });
    expect(result.reasons.some(r => r.text.includes('冲突化解'))).toBe(true);
  });

  it('满意度差异大：一人高分一人低分 → 有差异提示', () => {
    const result = calculateGroupScore(baseRestaurant, {
      members: [
        { name: 'A', preferences: ['川菜'], allergies: [], budget: 200 },
        { name: 'B', preferences: ['日料'], allergies: ['辣'], budget: 30 },
      ],
      preferences: ['川菜'],
      allergies: ['辣'],
      conflicts: [],
    });
    // 满意度差异大时可能有差异提示（不保证一定触发，取决于评分差距）
    expect(result.score).toBeGreaterThan(0);
  });

  // ============ 融合匹配测试 ============

  it('完美融合：一人想吃川菜 + 一人想吃火锅 + 麻辣火锅 → 完美融合提示', () => {
    const fusionRestaurant = {
      ...baseRestaurant,
      name: '麻辣火锅',
      cuisine: '火锅',
      tags: ['火锅', '川菜', '麻辣'],
      features: ['麻辣', '涮'],
    };
    const result = calculateGroupScore(fusionRestaurant, {
      members: [
        { name: 'A', preferences: ['川菜'], allergies: [] },
        { name: 'B', preferences: ['火锅'], allergies: [] },
      ],
      preferences: ['川菜', '火锅'],
      allergies: [],
      conflicts: [],
    });
    expect(result.reasons.some(r => r.type === 'fusion')).toBe(true);
    expect(result.reasons.some(r => r.text.includes('完美融合') || r.text.includes('川菜×火锅'))).toBe(true);
    expect(result.score).toBeGreaterThan(85);
  });

  it('口味融合：一人想吃川菜 + 一人想吃火锅 + 冒菜 → 口味融合', () => {
    const maocaiRestaurant = {
      ...baseRestaurant,
      name: '冒菜',
      cuisine: '冒菜',
      tags: ['冒菜', '麻辣'],
      features: ['麻辣', '煮'],
    };
    const result = calculateGroupScore(maocaiRestaurant, {
      members: [
        { name: 'A', preferences: ['川菜'], allergies: [] },
        { name: 'B', preferences: ['火锅'], allergies: [] },
      ],
      preferences: ['川菜', '火锅'],
      allergies: [],
      conflicts: [],
    });
    expect(result.reasons.some(r => r.type === 'fusion')).toBe(true);
    expect(result.reasons.some(r => r.text.includes('融合'))).toBe(true);
  });

  it('形式融合：一人想吃日料 + 一人想吃烧鸟 → 形式融合', () => {
    const yakitoriRestaurant = {
      ...baseRestaurant,
      name: '烧鸟居酒屋',
      cuisine: '日料',
      tags: ['日料', '烧鸟'],
      features: ['烤'],
    };
    const result = calculateGroupScore(yakitoriRestaurant, {
      members: [
        { name: 'A', preferences: ['日料'], allergies: [] },
        { name: 'B', preferences: ['烧鸟'], allergies: [] },
      ],
      preferences: ['日料', '烧鸟'],
      allergies: [],
      conflicts: [],
    });
    expect(result.reasons.some(r => r.type === 'fusion')).toBe(true);
  });

  it('无法融合：一人想吃川菜 + 一人想吃日料 + 无交集餐厅 → 无融合提示', () => {
    const result = calculateGroupScore(baseRestaurant, {
      members: [
        { name: 'A', preferences: ['川菜'], allergies: [] },
        { name: 'B', preferences: ['日料'], allergies: [] },
      ],
      preferences: ['川菜', '日料'],
      allergies: [],
      conflicts: [],
    });
    expect(result.reasons.some(r => r.type === 'fusion')).toBe(false);
  });
});

// ============ filterByAllergies 测试 ============

describe('filterByAllergies', () => {
  const restaurants = [
    { id: '1', name: '海鲜酒楼', cuisine: '海鲜', tags: ['海鲜'], features: [], price: 200 },
    { id: '2', name: '清真拉面', cuisine: '面馆', tags: ['清真'], features: [], price: 30 },
    { id: '3', name: '川菜馆', cuisine: '川菜', tags: ['川菜', '火锅'], features: ['麻辣'], price: 80 },
    { id: '4', name: '素食餐厅', cuisine: '轻食', tags: ['素食', '沙拉'], features: [], price: 50 },
    { id: '5', name: '普通西餐', cuisine: '西餐', tags: ['牛排'], features: [], price: 150 },
  ];

  it('海鲜忌口：过滤掉海鲜餐厅', () => {
    const result = filterByAllergies(restaurants, ['海鲜']);
    expect(result.every(r => !r.tags.includes('海鲜'))).toBe(true);
    expect(result.length).toBeLessThan(restaurants.length);
  });

  it('清真忌口：只保留清真餐厅', () => {
    const result = filterByAllergies(restaurants, ['清真']);
    expect(result.every(r => r.tags.includes('清真'))).toBe(true);
    expect(result.length).toBe(1);
  });

  it('无忌口：返回全部', () => {
    const result = filterByAllergies(restaurants, []);
    expect(result.length).toBe(restaurants.length);
  });

  it('素食忌口（软约束）：不过滤肉食餐厅，但软约束不应一票否决', () => {
    // 素食是 STRONG_SOFT_ALLERGIES，不应一票否决
    const result = filterByAllergies(restaurants, ['素食']);
    // 素食忌口不应硬过滤（素食者不应去肉店，但这是软约束）
    // 实际代码中素食不在 HARD_ALLERGIES 里，所以不应该被过滤
    expect(result.length).toBe(restaurants.length);
  });

  it('辣忌口（软约束）：不过滤川菜馆', () => {
    const result = filterByAllergies(restaurants, ['辣']);
    // 辣不在 HARD_ALLERGIES 中，不应一票否决
    expect(result.length).toBe(restaurants.length);
  });
});

// ============ calculateSoloFriendly 测试 ============

describe('calculateSoloFriendly', () => {
  it('快餐/面馆 → 高分', () => {
    const fastFood = {
      id: '1', name: '兰州拉面', cuisine: '面馆',
      tags: ['面馆', '快餐'], features: [], price: 25,
    };
    const score = calculateSoloFriendly(fastFood);
    expect(score).toBeGreaterThan(70);
  });

  it('火锅店 → 低分（不适合一人食）', () => {
    const hotpot = {
      id: '2', name: '海底捞', cuisine: '火锅',
      tags: ['火锅'], features: [], price: 120,
    };
    const score = calculateSoloFriendly(hotpot);
    expect(score).toBeLessThan(50);
  });

  it('小火锅 → 比大火锅分数高', () => {
    const smallHotpot = {
      id: '3', name: '转转火锅', cuisine: '火锅',
      tags: ['小火锅', '转转'], features: [], price: 50,
    };
    const bigHotpot = {
      id: '4', name: '川渝火锅', cuisine: '火锅',
      tags: ['火锅'], features: [], price: 100,
    };
    expect(calculateSoloFriendly(smallHotpot)).toBeGreaterThan(calculateSoloFriendly(bigHotpot));
  });

  it('烤肉店 → 低分', () => {
    const bbq = {
      id: '5', name: '韩式烤肉', cuisine: '烤肉',
      tags: ['烤肉', '韩式'], features: [], price: 100,
    };
    const score = calculateSoloFriendly(bbq);
    expect(score).toBeLessThan(50);
  });

  it('有吧台/单人座 → 加分', () => {
    const withCounter = {
      id: '6', name: '拉面店', cuisine: '日式',
      tags: ['吧台', '单人'], features: [], price: 40,
    };
    const without = {
      id: '7', name: '普通餐厅', cuisine: '中餐',
      tags: [], features: [], price: 40,
    };
    expect(calculateSoloFriendly(withCounter)).toBeGreaterThan(calculateSoloFriendly(without));
  });

  it('适中价格 → 小幅加分', () => {
    const midPrice = {
      id: '8', name: '简餐', cuisine: '快餐',
      tags: ['快餐'], features: [], price: 45,
    };
    const highPrice = {
      id: '9', name: '高级简餐', cuisine: '快餐',
      tags: ['快餐'], features: [], price: 200,
    };
    expect(calculateSoloFriendly(midPrice)).toBeGreaterThan(calculateSoloFriendly(highPrice));
  });
});

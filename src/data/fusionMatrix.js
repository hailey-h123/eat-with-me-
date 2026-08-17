/**
 * 偏好融合矩阵（单一数据源）
 *
 * 两类融合：
 * - CUISINE_FUSION_MATRIX：真融合（菜系 × 菜系），一家店天然同时属于两个菜系
 * - DEMAND_BRIDGE_MATRIX：需求桥接（需求 × 菜系），需求维度（辣/海鲜/清淡等）桥接菜系
 *
 * 消费方（scoringService.js / recommendationService.js）都从这里派生：
 * - FUSION_MATRIX        ← CUISINE_FUSION_MATRIX 双向派生（用于 checkFusion）
 * - getFusionSearchKeywords  ← CUISINE_FUSION_MATRIX 派生（真融合搜索词）
 * - getBridgeFusionMarkers   ← DEMAND_BRIDGE_MATRIX 派生（需求桥接搜索词 + 桥接偏好对）
 */

// ============ 真融合：菜系 × 菜系 ============
// key 用字典序 '菜系A|菜系B'；type: 'perfect'（完美融合）| 'flavor'（口味融合）| 'style'（形式融合）
export const CUISINE_FUSION_MATRIX = {
  // —— 火锅系 × 各菜系 ——
  '火锅|川菜': { type: 'flavor', searchKeywords: ['麻辣火锅', '川味火锅', '四川火锅', '重庆火锅', '火锅冒菜', '麻辣烫'] },
  '火锅|湘菜': { type: 'flavor', searchKeywords: ['湘味火锅', '湖南火锅'] },
  '火锅|粤菜': { type: 'style', searchKeywords: ['打边炉', '粤式火锅', '粥底火锅', '猪肚鸡'] },
  '火锅|日料': { type: 'style', searchKeywords: ['寿喜烧', '日式火锅', '涮涮锅', '日式涮锅'] },
  '火锅|韩餐': { type: 'flavor', searchKeywords: ['部队锅', '韩式火锅', '部队火锅'] },
  '火锅|烧烤': { type: 'style', searchKeywords: ['火锅烧烤', '烤肉火锅', '涮烤', '烤涮一体', '自助烧烤火锅', '火锅烤肉自助', '烤涮'] },
  '火锅|烤肉': { type: 'style', searchKeywords: ['火锅烧烤', '烤肉火锅', '涮烤', '烤涮一体', '自助烧烤火锅', '火锅烤肉自助', '烤涮'] },
  '火锅|冒菜': { type: 'style', searchKeywords: ['火锅冒菜', '冒菜'] },
  '火锅|麻辣烫': { type: 'style', searchKeywords: ['麻辣烫', '串串'] },
  '火锅|串串': { type: 'style', searchKeywords: ['串串', '串串香'] },
  '火锅|贵州菜': { type: 'style', searchKeywords: ['酸汤火锅', '贵州火锅', '酸汤鱼火锅'] },
  '火锅|泰菜': { type: 'flavor', searchKeywords: ['冬阴功火锅', '泰式火锅'] },
  '火锅|北京菜': { type: 'style', searchKeywords: ['涮羊肉', '铜锅涮肉', '老北京涮肉'] },
  '火锅|云南菜': { type: 'style', searchKeywords: ['菌汤火锅', '汽锅鸡火锅'] },

  // —— 烧烤/烤肉系 × 各菜系 ——
  '烧烤|韩餐': { type: 'perfect', searchKeywords: ['韩式烧烤', '韩式烤肉', '韩国烤肉'] },
  '烧烤|日料': { type: 'style', searchKeywords: ['日式烧肉', '烧鸟'] },
  '烧烤|新疆菜': { type: 'perfect', searchKeywords: ['羊肉串', '新疆烤肉', '烤羊肉'] },
  '烧烤|东北菜': { type: 'style', searchKeywords: ['东北烧烤', '东北烤肉'] },
  '烧烤|湘菜': { type: 'flavor', searchKeywords: ['湘味烧烤', '湖南烤肉', '湖南烧烤'] },
  '烧烤|川菜': { type: 'flavor', searchKeywords: ['烤鱼', '麻辣烤鱼', '巫山烤鱼', '麻辣烧烤'] },
  '烧烤|粤菜': { type: 'style', searchKeywords: ['烧腊', '叉烧', '广式烧腊', '烧鹅'] },
  '烧烤|烧鸟': { type: 'style', searchKeywords: ['烧鸟', '日式烧鸟'] },
  '烤肉|烧烤': { type: 'style', searchKeywords: ['韩式烤肉', '日式烤肉', '自助烤肉'] },
  '烤肉|韩餐': { type: 'perfect', searchKeywords: ['韩式烤肉'] },
  '烤肉|川菜': { type: 'flavor', searchKeywords: ['麻辣烤肉', '川味烤肉', '麻辣烤串'] },
  '烤肉|湘菜': { type: 'flavor', searchKeywords: ['湖南烤肉', '湘味烤肉'] },
  '烤肉|烧鸟': { type: 'style', searchKeywords: ['烧鸟', '日式烤串'] },

  // —— 日韩 × 各菜系 ——
  '日料|韩餐': { type: 'flavor', searchKeywords: ['日韩料理', '韩日料理'] },
  '日料|烧鸟': { type: 'style', searchKeywords: ['日式烧鸟', '居酒屋', '烧鸟'] },
  '韩餐|烤肉': { type: 'style', searchKeywords: ['韩式烤肉'] },

  // —— 川菜 × 各菜系 ——
  '川菜|冒菜': { type: 'perfect', searchKeywords: ['麻辣冒菜', '川式冒菜', '冒菜'] },
  '川菜|湘菜': { type: 'flavor', searchKeywords: ['川湘菜'] },
  '川菜|麻辣烫': { type: 'flavor', searchKeywords: ['麻辣烫', '冒菜'] },
  '川菜|串串': { type: 'flavor', searchKeywords: ['串串', '冷锅串串'] },

  // —— 冒菜/麻辣烫/串串 同圈（火锅系的子形态互替） ——
  '冒菜|麻辣烫': { type: 'style', searchKeywords: ['麻辣烫', '冒菜'] },
  '冒菜|串串': { type: 'style', searchKeywords: ['冒菜', '串串'] },
  '麻辣烫|串串': { type: 'style', searchKeywords: ['麻辣烫', '串串'] },
};

// ============ 需求桥接：需求 × 菜系 ============
// key 用 '需求|菜系'；需求 = 意图里能识别为偏好的需求词（辣/海鲜/清淡等）
// 这些店 tags 里不含双方菜系，需显式打 _fusionPrefs 标记才能进融合桶
export const DEMAND_BRIDGE_MATRIX = {
  '辣|韩餐': { type: 'flavor', searchKeywords: ['火辣鸡排', '泡菜炒肉', '辣豆腐汤', '春川辣炒鸡排'] },
  '辣|日料': { type: 'flavor', searchKeywords: ['辛子拉面', '激辛拉面'] },
  '辣|泰菜': { type: 'flavor', searchKeywords: ['冬阴功', '泰式辣炒'] },
  '辣|东南亚菜': { type: 'flavor', searchKeywords: ['冬阴功', '咖喱'] },
  '海鲜|粤菜': { type: 'flavor', searchKeywords: ['海鲜酒楼', '海鲜大排档', '蒸海鲜'] },
  '海鲜|川菜': { type: 'flavor', searchKeywords: ['水煮鱼', '麻辣海鲜', '香辣蟹'] },
  '清淡|粤菜': { type: 'flavor', searchKeywords: ['蒸菜', '白切鸡', '广式炖汤'] },
  '清淡|日料': { type: 'flavor', searchKeywords: ['寿司', '刺身', '定食'] },
};

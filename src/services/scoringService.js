/**
 * 评分服务
 * 包含: 权重配置、菜系匹配、口味元素融合、忌口过滤、单人/群体评分、多样性平衡
 */
import { applyFeedbackToScore } from './feedbackService';

// ============ 口味元素分类（用于跨菜系融合匹配） ============

/**
 * 菜系大类分组
 */
const CUISINE_CATEGORIES = {
  '辣系': ['川菜', '湘菜', '贵州菜', '江西菜', '重庆菜', '四川菜'],
  '火锅系': ['火锅', '冒菜', '麻辣烫', '串串', '涮锅', '铜锅', '鸳鸯锅', '四川火锅', '重庆火锅', '火锅烧烤', '烤肉火锅'],
  '烧烤系': ['烤肉', '烧烤', '烤串', '韩式烤肉', '日式烤肉', '烧肉', '火锅烧烤', '烤肉火锅'],
  '日韩系': ['日料', '寿司', '刺身', '烧鸟', '居酒屋', '日式', '日本料理', '韩餐', '韩国料理', '韩式'],
  '江南系': ['江浙菜', '粤菜', '本帮菜', '杭帮菜', '上海菜', '淮扬菜', '宁波菜', '无锡菜'],
  '北方系': ['东北菜', '北京菜', '鲁菜', '西北菜', '新疆菜'],
  '面食系': ['面馆', '米线', '粉', '拉面', '牛肉面', '刀削面', '饺子', '包子', '锅贴'],
  '轻食系': ['沙拉', '轻食', '健康餐', '低卡', '减脂', '素食'],
  '海鲜系': ['海鲜', '鱼鲜', '虾', '蟹', '贝类'],
  '甜点系': ['甜品', '蛋糕', '面包', '奶茶', '饮品'],
};

/**
 * 口味特征维度
 */
const FLAVOR_DIMENSIONS = {
  // 辣度
  spicy: ['麻辣', '香辣', '微辣', '中辣', '特辣', '酸辣', '干辣'],
  // 温度/形式
  temperature: ['热汤', '火锅', '涮', '烤制', '凉拌', '冰品', '温热'],
  // 口感
  taste: ['鲜', '酸', '甜', '清淡', '浓郁', '香', '酥脆', '嫩滑'],
  // 形式
  style: ['涮', '烤', '炒', '蒸', '煮', '拌', '炸', '炖'],
  // 社交属性
  social: ['适合一人食', '适合聚餐', '有包间', '需预约', '排队多'],
};

/**
 * 菜系的核心特征映射
 */
const CUISINE_FLAVOR_PROFILE = {
  '川菜': { spicy: ['麻辣', '香辣'], taste: ['浓郁'], style: ['炒', '烧', '干煸', '炝'] },
  '湘菜': { spicy: ['香辣', '微辣'], taste: ['鲜', '酸'], style: ['炒', '剁椒'] },
  '火锅': { temperature: ['热汤', '涮'], style: ['涮', '烫', '焖'], social: ['适合聚餐'] },
  '冒菜': { temperature: ['热汤'], style: ['烫', '焖'], spicy: ['麻辣', '香辣'] },
  '麻辣烫': { temperature: ['热汤'], style: ['烫'], spicy: ['麻辣'] },
  '串串': { temperature: ['热汤'], style: ['涮'], spicy: ['麻辣', '香辣'] },
  '烤肉': { temperature: ['烤制'], style: ['烤'], social: ['适合聚餐'] },
  '烧烤': { temperature: ['烤制'], style: ['烤'], taste: ['香', '酥脆'] },
  '日料': { taste: ['鲜', '清淡'], style: ['蒸', '拌'], temperature: ['凉拌'] },
  '烧鸟': { temperature: ['烤制'], style: ['烤'], taste: ['香'] },
  '韩餐': { spicy: ['微辣'], style: ['烤', '炒'], taste: ['鲜'] },
  '江浙菜': { taste: ['鲜', '甜', '清淡'], style: ['蒸', '炒', '炖'] },
  '粤菜': { taste: ['鲜', '清淡'], style: ['蒸', '炒', '炖'] },
  '东北菜': { taste: ['浓郁', '香'], style: ['炒', '炖', '烤'], social: ['适合聚餐'] },
  '新疆菜': { taste: ['香', '浓郁'], style: ['烤', '炒'], temperature: ['烤制'] },
};

/**
 * 跨菜系融合关联矩阵
 * 格式: { 菜系A: { 菜系B: '融合类型' } }
 * 融合类型: 'perfect'(完美融合) | 'flavor'(口味融合) | 'style'(形式融合) | 'none'(无法融合)
 */
const FUSION_MATRIX = {
  '川菜': {
    '火锅': 'flavor',       // 共享麻辣，但重庆火锅≠川菜
    '冒菜': 'perfect',      // 川式冒菜
    '麻辣烫': 'flavor',     // 有麻辣元素
    '串串': 'flavor',       // 有麻辣元素
    '湘菜': 'flavor',       // 都偏辣
    '烤鱼': 'flavor',       // 麻辣烤鱼
    '烧烤': 'flavor',       // 麻辣烧烤/川式烤肉
    '烤肉': 'flavor',       // 麻辣系烤肉
  },
  '火锅': {
    '川菜': 'flavor',
    '冒菜': 'style',        // 形式类似
    '麻辣烫': 'style',      // 形式类似
    '串串': 'style',        // 形式类似
    '烤肉': 'style',        // 烤涮一体
    '烧烤': 'style',        // 烤涮一体
    '粤菜': 'style',        // 打边炉/粥底火锅
    '湘菜': 'flavor',       // 湘味火锅
    '韩餐': 'flavor',       // 部队锅
    '日料': 'style',        // 寿喜烧/涮涮锅
  },
  '冒菜': {
    '川菜': 'perfect',
    '火锅': 'style',
    '麻辣烫': 'style',
    '串串': 'style',
  },
  '烤肉': {
    '烧烤': 'style',        // 都是烤制
    '韩式烤肉': 'perfect',  // 直接匹配
    '烧鸟': 'style',        // 都是烤制
    '火锅': 'style',        // 烤涮一体
    '川菜': 'flavor',       // 麻辣系烤肉
    '湘菜': 'flavor',       // 湖南烤肉
  },
  '烧烤': {
    '烤肉': 'style',        // 都是烤制
    '烧鸟': 'style',        // 都是烤制
    '火锅': 'style',        // 烤涮一体
    '韩餐': 'perfect',      // 韩式烧烤
    '川菜': 'flavor',       // 麻辣烧烤
    '湘菜': 'flavor',       // 湘味烧烤
    '东北菜': 'style',      // 东北烧烤
    '新疆菜': 'perfect',    // 新疆羊肉串
    '粤菜': 'style',        // 烧腊/叉烧
  },
  '日料': {
    '烧鸟': 'style',        // 都属日系
    '韩餐': 'flavor',       // 东亚风味
    '寿司': 'perfect',      // 直接匹配
    '火锅': 'style',        // 寿喜烧/涮涮锅
  },
  '烧鸟': {
    '日料': 'style',
    '烤肉': 'style',
    '烧烤': 'style',
  },
  '韩餐': {
    '日料': 'flavor',
    '烤肉': 'style',
    '韩式烤肉': 'perfect',
    '烧烤': 'perfect',      // 韩式烧烤
    '火锅': 'flavor',       // 部队锅
  },
  '湘菜': {
    '川菜': 'flavor',       // 都偏辣
    '烧烤': 'flavor',       // 湘味烧烤
    '火锅': 'flavor',       // 湘味火锅
    '烤肉': 'flavor',       // 湖南烤肉
  },
  '东北菜': {
    '烧烤': 'style',        // 东北烧烤
  },
  '新疆菜': {
    '烧烤': 'perfect',      // 羊肉串
  },
  '粤菜': {
    '火锅': 'style',        // 打边炉/粥底火锅
    '烧烤': 'style',        // 烧腊/叉烧
  },
};

/**
 * 检查两个偏好是否能融合
 * @returns {{ canFusion: boolean, fusionType: string, fusionReason: string }}
 */
function checkFusion(pref1, pref2, restaurantFeatures) {
  // 1. 直接匹配检查（限制长度差，避免子串误匹配）
  const directMatch1 = restaurantFeatures.some(f => {
    if (f === pref1) return true;
    if (f.includes(pref1) && (f.length - pref1.length) <= 4) return true;
    return false;
  });
  const directMatch2 = restaurantFeatures.some(f => {
    if (f === pref2) return true;
    if (f.includes(pref2) && (f.length - pref2.length) <= 4) return true;
    return false;
  });
  
  if (directMatch1 && directMatch2) {
    return {
      canFusion: true,
      fusionType: 'perfect',
      fusionReason: '同时契合两种偏好',
      member1Reason: `完美契合${pref1}`,
      member2Reason: `完美契合${pref2}`,
      member1Matched: [pref1],
      member2Matched: [pref2],
    };
  }
  
  // 2. 查找融合矩阵
  const fusionType = FUSION_MATRIX[pref1]?.[pref2] || FUSION_MATRIX[pref2]?.[pref1];
  
  if (fusionType && fusionType !== 'none') {
    const profile1 = CUISINE_FLAVOR_PROFILE[pref1] || {};
    const profile2 = CUISINE_FLAVOR_PROFILE[pref2] || {};
    
    let fusionDetail = checkFusionElements(restaurantFeatures, profile1, profile2, fusionType);
    
    // 元素级匹配失败时，按融合类型选择兜底元素
    if (!fusionDetail.canFusion) {
      // 类别级匹配：检查餐厅特征是否与偏好菜系直接相关
      // 限制：只接受精确匹配或强关联（长度差 <= 4），避免子串误匹配
      const hasPref = (pref) => restaurantFeatures.some(f => {
        if (f === pref) return true;
        if (f.includes(pref) && (f.length - pref.length) <= 4) return true;
        if (pref.includes(f) && f.length >= 2) return true;
        for (const cuisines of Object.values(CUISINE_CATEGORIES)) {
          if (cuisines.some(c => c === pref)) {
            return cuisines.some(c => {
              if (c === f) return true;
              if (f.includes(c) && (f.length - c.length) <= 4) return true;
              if (c.includes(f) && f.length >= 2) return true;
              return false;
            });
          }
        }
        return false;
      });
      const hasPref1 = hasPref(pref1);
      const hasPref2 = hasPref(pref2);
      // 必须两边偏好都在餐厅特征中有直接体现，才算融合
      if (hasPref1 && hasPref2) {
        const p1 = CUISINE_FLAVOR_PROFILE[pref1] || {};
        const p2 = CUISINE_FLAVOR_PROFILE[pref2] || {};
        let fallbackElements;
        if (fusionType === 'flavor') {
          // 口味融合只用辣度+口感元素
          fallbackElements = [
            ...(p1.spicy || []), ...(p1.taste || []),
            ...(p2.spicy || []), ...(p2.taste || []),
          ];
        } else if (fusionType === 'style') {
          // 形式融合只用做法+温度元素
          fallbackElements = [
            ...(p1.style || []), ...(p2.style || []),
            ...(p1.temperature || []).filter(t => ['热汤', '涮'].includes(t)),
            ...(p2.temperature || []).filter(t => ['热汤', '涮'].includes(t)),
          ];
        } else {
          fallbackElements = [...(p1.spicy || []), ...(p1.taste || []), ...(p1.style || []),
                             ...(p2.spicy || []), ...(p2.taste || []), ...(p2.style || [])];
        }
        fusionDetail = {
          canFusion: true,
          matched1: fallbackElements,
          matched2: fallbackElements,
        };
      }
    }
    
    if (fusionDetail.canFusion) {
      const fusionReason = getFusionReason(pref1, pref2, fusionType, fusionDetail);
      return {
        canFusion: true,
        fusionType,
        fusionReason,
        member1Reason: fusionReason.member1Reason,
        member2Reason: fusionReason.member2Reason,
        member1Matched: fusionDetail.matched1,
        member2Matched: fusionDetail.matched2,
      };
    }
  }
  
  // 3. 通过口味特征融合
  const allFlavorFeatures = [...new Set([...restaurantFeatures])];
  const flavorFusion = checkFlavorFusion(pref1, pref2, allFlavorFeatures);
  if (flavorFusion) {
    return flavorFusion;
  }
  
  return { canFusion: false, fusionType: 'none', fusionReason: '', member1Reason: '', member2Reason: '', member1Matched: [], member2Matched: [] };
}

/**
 * 检查餐厅是否有融合所需的元素，并返回具体匹配详情
 */
function checkFusionElements(restaurantFeatures, profile1, profile2, fusionType) {
  const featureText = restaurantFeatures.join(' ');
  
  const getMatchedElements = (elements) => {
    return elements.filter(f => 
      restaurantFeatures.some(rf => rf.includes(f)) || featureText.includes(f)
    );
  };
  
  if (fusionType === 'perfect') {
    const features1 = [...(profile1.spicy || []), ...(profile1.style || []), ...(profile1.temperature || [])];
    const features2 = [...(profile2.spicy || []), ...(profile2.style || []), ...(profile2.temperature || [])];
    const matched1 = getMatchedElements(features1);
    const matched2 = getMatchedElements(features2);
    const hasFrom1 = matched1.length > 0;
    const hasFrom2 = matched2.length > 0;
    return {
      canFusion: hasFrom1 && hasFrom2,
      matched1: hasFrom1 ? matched1 : [],
      matched2: hasFrom2 ? matched2 : [],
    };
  }
  
  if (fusionType === 'flavor') {
    const allFlavorElements = [
      ...(profile1.spicy || []), ...(profile1.taste || []),
      ...(profile2.spicy || []), ...(profile2.taste || []),
    ];
    const matched = getMatchedElements(allFlavorElements);
    return {
      canFusion: matched.length > 0,
      matched1: matched,
      matched2: matched,
    };
  }
  
  if (fusionType === 'style') {
    // 必须双方profile各有至少一个做法元素命中，纯烤肉店不会误判为火锅融合
    const matched1 = getMatchedElements(profile1.style || []);
    const matched2 = getMatchedElements(profile2.style || []);
    return {
      canFusion: matched1.length > 0 && matched2.length > 0,
      matched1,
      matched2,
    };
  }
  
  return { canFusion: false, matched1: [], matched2: [] };
}

/**
 * 检查两个偏好是否属于同一大类（有融合基础）
 */
function areInSameCategory(pref1, pref2) {
  const pref1Category = Object.keys(CUISINE_CATEGORIES).find(cat =>
    CUISINE_CATEGORIES[cat].some(c => c === pref1 || c.includes(pref1))
  );
  const pref2Category = Object.keys(CUISINE_CATEGORIES).find(cat =>
    CUISINE_CATEGORIES[cat].some(c => c === pref2 || c.includes(pref2))
  );
  if (pref1Category && pref2Category && pref1Category !== pref2Category) {
    // 不同大类，但以下组合实际可融合
    const spicy = CUISINE_CATEGORIES['辣系'] || [];
    const hotpot = CUISINE_CATEGORIES['火锅系'] || [];
    const grill = CUISINE_CATEGORIES['烧烤系'] || [];
    const jpkr = CUISINE_CATEGORIES['日韩系'] || [];
    const north = CUISINE_CATEGORIES['北方系'] || [];
    const jiangnan = CUISINE_CATEGORIES['江南系'] || [];
    const crossAllowed = [
      [spicy, hotpot],     // 麻辣火锅
      [grill, hotpot],     // 烤涮一体
      [spicy, grill],      // 麻辣烧烤
      [north, grill],      // 东北烧烤/新疆烤肉
      [jpkr, grill],       // 韩式烤肉/日式烧肉
      [jpkr, hotpot],      // 部队锅/寿喜烧
      [jiangnan, hotpot],  // 打边炉
    ];
    const isCross = crossAllowed.some(([a, b]) =>
      (a.includes(pref1) && b.includes(pref2)) ||
      (a.includes(pref2) && b.includes(pref1))
    );
    if (isCross) return true;
    return false;
  }
  return true; // 同一类或未知类别，允许融合
}

/**
 * 检查口味特征层面的融合
 * @param {string} pref1 成员1的偏好
 * @param {string} pref2 成员2的偏好
 * @param {Array<string>} allFeatures 餐厅的所有特征（tags + cuisine + name）
 */
function checkFlavorFusion(pref1, pref2, allFeatures) {
  if (!areInSameCategory(pref1, pref2)) {
    return null;
  }
  
  // 餐厅必须与两个偏好菜系都有直接关联（不能只靠共享关键词）
  const getCategoryCuisines = (pref) => {
    for (const cuisines of Object.values(CUISINE_CATEGORIES)) {
      if (cuisines.some(c => c === pref)) return cuisines;
    }
    return [];
  };
  const cat1 = getCategoryCuisines(pref1);
  const cat2 = getCategoryCuisines(pref2);
  if (cat1.length > 0 && cat2.length > 0) {
    // 限制子串匹配长度差，避免宽泛误匹配
    const related1 = allFeatures.some(f => cat1.some(c => {
      if (c === f) return true;
      if (f.includes(c) && (f.length - c.length) <= 4) return true;
      if (c.includes(f) && f.length >= 2) return true;
      return false;
    }));
    const related2 = allFeatures.some(f => cat2.some(c => {
      if (c === f) return true;
      if (f.includes(c) && (f.length - c.length) <= 4) return true;
      if (c.includes(f) && f.length >= 2) return true;
      return false;
    }));
    if (!related1 || !related2) return null;
  }
  
  const allText = allFeatures.join(' ');

  const spicyKeywords = FLAVOR_DIMENSIONS.spicy;
  const matchedSpicy = spicyKeywords.filter(k => allText.includes(k));

  // 火锅相关关键词：必须是双字以上复合词（避免"中餐厅"中的"厅"误匹配）
  // 单字"涮"/"烫"/"焖"在菜系名/餐厅类型 tag 中太容易误命中，故剔除
  const hotKeywords = ['火锅', '热汤', '涮锅', '涮肉', '铜锅', '鸳鸯锅', '打边炉', '锅物', '四川火锅', '重庆火锅'];
  const matchedHot = hotKeywords.filter(k => allText.includes(k));

  // 烧烤相关关键词：双字以上避免"店名含"烤""误匹配
  const roastKeywords = ['烧烤', '烤串', '烤肉', '韩式烤肉', '日式烤肉', '烧肉'];
  const matchedRoast = roastKeywords.filter(k => allText.includes(k));
  
  const hasSpicy = matchedSpicy.length > 0;
  const hasHot = matchedHot.length > 0;
  const hasRoast = matchedRoast.length > 0;
  
  const pref1Profile = CUISINE_FLAVOR_PROFILE[pref1] || {};
  const pref2Profile = CUISINE_FLAVOR_PROFILE[pref2] || {};
  
  const pref1NeedsSpicy = (pref1Profile.spicy || []).length > 0;
  const pref2NeedsSpicy = (pref2Profile.spicy || []).length > 0;
  const pref1NeedsHot = (pref1Profile.temperature || []).some(t => ['热汤', '火锅', '涮'].includes(t));
  const pref2NeedsHot = (pref2Profile.temperature || []).some(t => ['热汤', '火锅', '涮'].includes(t));
  const pref1NeedsRoast = (pref1Profile.style || []).includes('烤');
  const pref2NeedsRoast = (pref2Profile.style || []).includes('烤');
  
  const getMemberReason = (pref, matched, profile, fusionType) => {
    // 只保留与该成员profile相关的匹配元素（如火锅成员不应看到"烤"做法）
    const profileElements = [
      ...(profile?.spicy || []), ...(profile?.taste || []),
      ...(profile?.style || []), ...(profile?.temperature || []),
    ];
    const relevant = matched.filter(m => profileElements.includes(m));
    const elementDesc = relevant.length > 0 ? relevant.slice(0, 2).join('、') : '';
    const hasSpicy = (profile?.spicy || []).length > 0;
    const hasHot = (profile?.temperature || []).some(t => ['热汤', '火锅', '涮'].includes(t));
    const hasRoast = (profile?.style || []).includes('烤');
    
    if (fusionType === 'flavor') {
      if (hasSpicy && elementDesc) return `带有${elementDesc}风味，满足${pref}的口味期待`;
      if (hasSpicy) return `风味接近${pref}的辣系`;
      return `风味接近${pref}`;
    }
    
    if (fusionType === 'style') {
      if (hasHot && elementDesc) return `采用${elementDesc}做法，与${pref}形式相近`;
      if (hasRoast && elementDesc) return `采用${elementDesc}做法，与${pref}形式相近`;
      if (hasHot || hasRoast) return `做法与${pref}相近`;
      return `做法与${pref}相近`;
    }
    
    return `契合${pref}需求`;
  };
  
  if ((pref1NeedsSpicy || pref2NeedsSpicy) && hasSpicy) {
    const member1Reason = getMemberReason(pref1, matchedSpicy, pref1Profile, 'flavor');
    const member2Reason = getMemberReason(pref2, matchedSpicy, pref2Profile, 'flavor');
    return {
      canFusion: true,
      fusionType: 'flavor',
      fusionReason: `主打${matchedSpicy.slice(0, 2).join('、')}风味，可满足${pref1}或${pref2}的口味期待`,
      member1Reason,
      member2Reason,
      member1Matched: matchedSpicy,
      member2Matched: matchedSpicy,
    };
  }
  
  if ((pref1NeedsHot || pref2NeedsHot) && hasHot) {
    const member1Reason = getMemberReason(pref1, matchedHot, pref1Profile, 'style');
    const member2Reason = getMemberReason(pref2, matchedHot, pref2Profile, 'style');
    return {
      canFusion: true,
      fusionType: 'style',
      fusionReason: `采用${matchedHot.slice(0, 2).join('、')}做法，可融合`,
      member1Reason,
      member2Reason,
      member1Matched: matchedHot,
      member2Matched: matchedHot,
    };
  }
  
  if ((pref1NeedsRoast || pref2NeedsRoast) && hasRoast) {
    // 烤制元素只传给需要烤制的成员，火锅成员拿空数组避免误判
    const member1Reason = getMemberReason(pref1, pref1NeedsRoast ? matchedRoast : [], pref1Profile, 'style');
    const member2Reason = getMemberReason(pref2, pref2NeedsRoast ? matchedRoast : [], pref2Profile, 'style');
    return {
      canFusion: true,
      fusionType: 'style',
      fusionReason: `采用烤制做法，可融合`,
      member1Reason,
      member2Reason,
      member1Matched: pref1NeedsRoast ? matchedRoast : [],
      member2Matched: pref2NeedsRoast ? matchedRoast : [],
    };
  }
  
  return null;
}

/**
 * 获取融合原因描述
 */
function getFusionReason(pref1, pref2, fusionType, fusionDetail) {
  const matched1 = fusionDetail?.matched1 || [];
  const matched2 = fusionDetail?.matched2 || [];
  
  const getElementDesc = (elements) => {
    if (elements.length === 0) return '';
    const uniqueElements = [...new Set(elements)].filter(e => e.length >= 1).slice(0, 2);
    return uniqueElements.join('、');
  };
  
  const getMemberReason = (pref, matched, profile) => {
    // 只保留与该成员profile相关的匹配元素
    const profileElements = [
      ...(profile?.spicy || []), ...(profile?.taste || []),
      ...(profile?.style || []), ...(profile?.temperature || []),
    ];
    const relevant = matched.filter(m => profileElements.includes(m));
    const elementDesc = getElementDesc(relevant);
    const hasSpicy = (profile?.spicy || []).length > 0;
    const hasHot = (profile?.temperature || []).some(t => ['热汤', '火锅', '涮'].includes(t));
    const hasRoast = (profile?.style || []).includes('烤');
    
    if (fusionType === 'perfect') {
      if (elementDesc) return `主打${elementDesc}，完美契合${pref}需求`;
      return `完美契合${pref}`;
    }
    
    if (fusionType === 'flavor') {
      if (hasSpicy && elementDesc) return `带有${elementDesc}风味，满足${pref}的口味期待`;
      if (hasSpicy) return `风味接近${pref}的辣系`;
      return `风味接近${pref}`;
    }
    
    if (fusionType === 'style') {
      if (hasHot && elementDesc) return `采用${elementDesc}做法，与${pref}形式相近`;
      if (hasRoast && elementDesc) return `采用${elementDesc}做法，与${pref}形式相近`;
      if (hasHot || hasRoast) return `做法与${pref}相近`;
      return `做法与${pref}相近`;
    }
    
    return `契合${pref}需求`;
  };
  
  const profile1 = CUISINE_FLAVOR_PROFILE[pref1] || {};
  const profile2 = CUISINE_FLAVOR_PROFILE[pref2] || {};
  
  let fusionReason = '';
  if (fusionType === 'perfect') {
    fusionReason = `${pref1}×${pref2}的完美融合`;
  } else if (fusionType === 'flavor') {
    if (matched1.length > 0 || matched2.length > 0) {
      fusionReason = `主打${getElementDesc([...matched1, ...matched2])}风味，可满足${pref1}或${pref2}的口味期待`;
    } else {
      fusionReason = `口味上有共通之处，可融合`;
    }
  } else if (fusionType === 'style') {
    fusionReason = `做法上有共通之处，可融合`;
  }
  
  return {
    fusionReason,
    member1Reason: getMemberReason(pref1, matched1, profile1),
    member2Reason: getMemberReason(pref2, matched2, profile2),
  };
}

// ============ 菜系关键词 & 语义映射 ============

const CUISINE_KEYWORDS_FOR_FILTER = {
  '地方菜系': ['川菜', '湘菜', '粤菜', '江浙菜', '北京菜', '云南菜', '本帮菜', '杭帮菜', '东北菜', '西北菜', '贵州菜', '鲁菜', '江西菜', '福建菜', '广西菜', '新疆菜', '淮扬菜'],
  '火锅': ['火锅', '涮锅', '串串', '麻辣烫', '冒菜', '铜锅'],
  '烧烤烤肉': ['烤肉', '烧烤', '烤串', '撸串', '烤鱼', '韩式烤肉'],
  '异域料理': ['日料', '寿司', '刺身', '拉面', '日式', '日本料理', '西餐', '西式', '牛排', '意大利菜', '法式', '东南亚菜', '泰国菜', '越南菜', '新加坡', '马来西亚', '韩餐', '韩国料理', '韩式'],
  '自助餐': ['自助', '自助餐'],
  '鱼鲜海鲜': ['海鲜', '鱼', '虾', '蟹', '贝类'],
  '小吃快餐': ['快餐', '汉堡', '炸鸡', '面馆', '米线', '粉', '小吃', '便当', '盒饭'],
  '饮品店': ['咖啡', '奶茶', '饮品'],
  '面包蛋糕甜品': ['甜品', '蛋糕', '面包', '点心'],
  '轻食健康': ['沙拉', '轻食', '健康餐', '低卡', '减脂', '素食'],
  '饺子包子': ['饺子', '包子', '小笼包', '锅贴'],
  '粥汤': ['粥', '稀饭', '汤', '炖汤'],
  '烧腊卤味': ['烧腊', '叉烧', '卤味'],
};

const CUISINE_SEMANTIC_MAP = {
  '烤肉': ['韩式烤肉', '韩国料理', '韩餐', '韩式', '日式烤肉', '烧肉', '烤肉', '炙烤'],
  '烧烤': ['烧烤', '韩国料理', '韩餐', '韩式', '烤肉', '烧肉', '炙烤'],
  '火锅': ['四川火锅', '重庆火锅', '川渝火锅', '串串', '麻辣烫', '涮肉', '铜锅', '鸳鸯锅', '打边炉', '火锅', '涮锅', '锅物'],
  '日料': ['日本料理', '日式', '寿司', '刺身', '居酒屋', '日餐', '定食', '丼饭', '和食', '日料', '日本'],
  '韩餐': ['韩国料理', '韩式', '烤肉', '韩餐', '韩国', '首尔', '朝鲜'],
  '韩国料理': ['韩餐', '韩式', '烤肉', '韩国', '首尔', '朝鲜'],
  '西餐': ['西式', '牛排', '意大利菜', '法式', '外国餐厅', '咖啡厅', '西餐厅', '意式', '美式', '西餐', '欧式', '欧陆'],
  '川菜': ['四川菜', '重庆菜', '麻辣', '川渝', '四川', '川味', '蜀', '成都', '自贡', '乐山', '宜宾', '泸州', '达州', '内江'],
  '湘菜': ['湖南菜', '湘', '湖南', '长沙', '岳阳', '衡阳', '湘西', '张家界', '常德', '株洲', '湘潭'],
  '粤菜': ['广东菜', '广式', '潮汕', '茶餐厅', '粤', '广东', '广州', '顺德', '汕头', '港式', '香港', '深圳', '佛山', '珠海'],
  '江浙菜': ['江南菜', '本帮菜', '杭帮菜', '上海菜', '淮扬菜', '无锡菜', '宁波菜', '苏', '浙', '江南', '杭州', '苏州', '上海', '宁波', '绍兴', '扬州', '南京', '无锡', '常州', '嘉兴', '湖州'],
  '东北菜': ['东北', '龙江', '沈阳', '哈尔滨', '长春', '辽', '吉', '黑', '大连', '鞍山', '齐齐哈尔'],
  '西北菜': ['陕西菜', '西安菜', '兰州菜', '西北', '陕', '西安', '兰州', '西宁', '宁夏', '甘肃', '青海'],
  '云南菜': ['滇菜', '滇', '云南', '昆明', '大理', '丽江', '西双版纳', '香格里拉', '曲靖'],
  '贵州菜': ['黔菜', '黔', '贵州', '贵阳', '遵义', '六盘水', '毕节'],
  '北京菜': ['京菜', '京', '北京', '北平', '京味', '老北京'],
  '鲁菜': ['山东菜', '孔府菜', '鲁', '山东', '济南', '青岛', '烟台', '潍坊', '淄博', '威海'],
  '江西菜': ['赣菜', '赣', '江西', '南昌', '九江', '景德镇', '上饶', '赣州'],
  '福建菜': ['闽菜', '福州菜', '闽', '福建', '福州', '厦门', '泉州', '漳州', '莆田', '宁德'],
  '广西菜': ['桂菜', '桂', '广西', '南宁', '桂林', '柳州', '北海', '梧州'],
  '新疆菜': ['新疆', '疆', '乌鲁木齐', '喀什', '伊犁', '吐鲁番'],
  '海鲜': ['海鲜料理', '水产', '海虾', '螃蟹', '贝类', '海鲜', '渔港', '渔家', '海鲜舫'],
  '沙拉': ['西餐', '外国餐厅', '咖啡厅', '轻食', '健康餐', '低卡', '简餐', '沙拉', '色拉'],
  '轻食': ['西餐', '外国餐厅', '咖啡厅', '沙拉', '健康餐', '低卡', '减脂', '简餐', '轻食'],
  '健康餐': ['西餐', '外国餐厅', '咖啡厅', '沙拉', '轻食', '低卡', '减脂', '简餐', '健康餐'],
  '快餐': ['快餐', '便当', '盒饭', '简餐', '小吃', '汉堡', '速食'],
  '面馆': ['面馆', '米粉', '拉面', '刀削面', '烩面', '热干面', '拌面', '汤面', '面庄', '面家', '面食'],
  '饺子': ['水饺', '煎饺', '蒸饺', '锅贴', '饺子', '饺子馆'],
  '包子': ['小笼包', '汤包', '叉烧包', '包子', '包子铺', '包点'],
  '粥': ['稀饭', '粥铺', '砂锅粥', '海鲜粥', '粥', '粥店'],
  '汤': ['炖汤', '煲汤', '老火汤', '靓汤', '汤', '汤馆', '汤品'],
  '烧腊': ['叉烧', '烧鹅', '烤鸭', '卤味', '烧腊', '烧腊店'],
  '卤味': ['卤肉', '卤菜', '卤水', '卤味', '卤煮'],
};

// 菜系相似关系（用于推荐替代菜系）
const SIMILAR_CUISINES = {
  '东北菜': ['北方菜', '北京菜', '鲁菜', '西北菜'],
  '北京菜': ['北方菜', '东北菜', '鲁菜'],
  '鲁菜': ['北方菜', '北京菜', '东北菜'],
  '西北菜': ['北方菜', '新疆菜', '东北菜'],
  '川菜': ['湘菜', '贵州菜', '江西菜', '云南菜'],
  '湘菜': ['川菜', '贵州菜', '江西菜'],
  '贵州菜': ['川菜', '湘菜', '云南菜'],
  '粤菜': ['潮汕菜', '福建菜', '广西菜', '海南菜'],
  '潮汕菜': ['粤菜', '福建菜'],
  '福建菜': ['粤菜', '潮汕菜', '台湾菜'],
  '江浙菜': ['本帮菜', '杭帮菜', '淮扬菜', '安徽菜'],
  '本帮菜': ['江浙菜', '杭帮菜', '淮扬菜'],
  '杭帮菜': ['江浙菜', '本帮菜', '宁波菜'],
  '淮扬菜': ['江浙菜', '南京菜', '安徽菜'],
  '云南菜': ['贵州菜', '川菜', '东南亚菜'],
  '新疆菜': ['西北菜', '清真菜'],
  '广西菜': ['粤菜', '贵州菜', '云南菜'],
  '江西菜': ['湘菜', '川菜', '安徽菜'],
  '日料': ['韩餐', '日式料理', '居酒屋'],
  '韩餐': ['日料', '韩式料理', '韩国料理'],
  '西餐': ['意大利菜', '法式餐厅', '美式餐厅', '融合菜'],
  '意大利菜': ['西餐', '披萨', '意面'],
  '法式餐厅': ['西餐', '法餐', '精致料理'],
  '火锅': ['串串', '麻辣烫', '冒菜', '涮锅'],
  '串串': ['火锅', '麻辣烫', '冒菜'],
  '烧烤': ['烤肉', '烤串', '日式烤肉', '韩式烤肉'],
  '烤肉': ['烧烤', '烤串', '韩式烤肉', '日式烤肉'],
  '海鲜': ['鱼鲜', '大排档', '海鲜酒楼'],
  '快餐': ['汉堡', '炸鸡', '便当', '小吃'],
  '面馆': ['米线', '粉', '拉面', '面食'],
  '饺子': ['包子', '锅贴', '小笼包', '面食'],
  '包子': ['饺子', '小笼包', '汤包', '面食'],
  '轻食': ['沙拉', '健康餐', '低卡餐', '素食'],
  '沙拉': ['轻食', '健康餐', '低卡餐'],
  '咖啡': ['咖啡厅', '咖啡馆', '下午茶'],
  '奶茶': ['饮品店', '甜水铺', '下午茶'],
  '甜品': ['面包蛋糕', '甜水铺', '下午茶'],
};

// ============ 评分权重 ============

const WEIGHTS = {
  cuisine: 0.34,      // 偏好匹配
  budget: 0.12,       // 预算
  distance: 0.22,     // 距离
  rating: 0.16,       // 评分
  popularity: 0.08,
  priceFit: 0.04,
  novelty: 0.04,
  seasonFit: 0.00,    // 季节性失效，权重归零
  timeFit: 0.00,      // 时段性失效，权重归零
};

// ============ 辅助函数 ============

function checkSemanticMatch(pref, restaurantFeatures) {
  const semanticKeywords = CUISINE_SEMANTIC_MAP[pref];
  if (!semanticKeywords) return false;
  return semanticKeywords.some(keyword =>
    restaurantFeatures.some(f =>
      f.includes(keyword) || (keyword.includes(f) && f.length >= 3)
    )
  );
}

function checkPrefMatch(pref, restaurantFeatures) {
  // 精确匹配：tag 完全等于偏好
  if (restaurantFeatures.some(f => f === pref)) {
    return true;
  }
  // 反向包含：偏好包含 tag（如 pref='韩式烤肉'，f='烤肉'）→ 短tag为偏好的子集，有效
  if (restaurantFeatures.some(f => pref.includes(f) && f.length >= 2)) {
    return true;
  }
  // 正向包含：tag 包含偏好（如 f='金针菇烤串'，pref='烤串'）
  // 限制：tag 长度 <= 偏好长度 + 4，防止菜品标签误判为菜系
  // 例如 pref='烤串'，f='烤串' → ok（菜系级）
  // 例如 pref='烤串'，f='金针菇烤串' → 跳过（菜品级，长度差>4）
  if (restaurantFeatures.some(f => f.includes(pref) && (f.length - pref.length) <= 4)) {
    return true;
  }
  return checkSemanticMatch(pref, restaurantFeatures);
}

function powerScale(value, power = 2) {
  return Math.pow(value, power);
}

function normalizeScore(score, min = 0, max = 100) {
  return Math.max(min, Math.min(max, score));
}

/**
 * 分数拉伸映射：把内部计算的原始分 [35,85] 拉伸到展示分 [52,99]
 */
function stretchScore(raw) {
  const safeRaw = typeof raw === 'number' && !isNaN(raw) ? raw : 60;
  const min = 35, max = 85;
  const targetMin = 52, targetMax = 99;
  const clamped = Math.max(min, Math.min(max, safeRaw));
  const ratio = (clamped - min) / (max - min);
  const safeRatio = typeof ratio === 'number' && !isNaN(ratio) && isFinite(ratio) ? ratio : 0.5;
  const stretchedRatio = Math.pow(safeRatio, 0.7);
  const stretched = targetMin + stretchedRatio * (targetMax - targetMin);
  const result = Math.round(stretched * 10) / 10;
  return (typeof result === 'number' && !isNaN(result)) ? result : 75;
}

function getSeason() {
  const month = new Date().getMonth() + 1;
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'autumn';
  return 'winter';
}

export function getTimeSlot() {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 9) return 'breakfast';
  if (hour >= 9 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 14) return 'lunch';
  if (hour >= 14 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'dinner';
  return 'late_night';
}

// ============ 一人食友好度评分 ============

export function calculateSoloFriendly(restaurant) {
  let score = 50;
  const allText = [
    ...(restaurant.tags || []),
    ...(restaurant.features || []),
    restaurant.cuisine || '',
    restaurant.name || '',
  ].join('').toLowerCase();

  const soloKeywords = ['吧台', '单人', 'counter'];
  if (soloKeywords.some(kw => allText.includes(kw))) {
    score += 20;
  }

  const fastFoodKeywords = ['快餐', '小吃', '面馆', '米线', '拉面'];
  if (fastFoodKeywords.some(kw => allText.includes(kw))) {
    score += 15;
  }

  const cuisineKeywords = ['日式', '定食', '快餐', '小吃'];
  if (cuisineKeywords.some(kw => allText.includes(kw))) {
    score += 10;
  }

  const hasHotpot = allText.includes('火锅');
  const hasSmallHotpot = allText.includes('小火锅') || allText.includes('转转');
  if (hasHotpot && !hasSmallHotpot) {
    score -= 30;
  }

  const hasBBQ = allText.includes('烤肉') || allText.includes('烧烤');
  const hasSingleBBQ = allText.includes('单人');
  if (hasBBQ && !hasSingleBBQ) {
    score -= 20;
  }

  const price = restaurant.price;
  if (price && price >= 20 && price <= 80) {
    score += 5;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

// ============ 忌口过滤 ============

// 硬约束忌口：一票否决（健康/宗教，完全不能碰）
const HARD_ALLERGIES = ['清真', '海鲜', '坚果', '花生', '牛奶', '乳糖不耐'];

// 强力软约束：不否决，但大幅降分（如素食，肉餐厅也有素菜可选）
const STRONG_SOFT_ALLERGIES = ['素食'];

// 普通软约束：不否决，适度降分
const SOFT_ALLERGIES = ['辣', '麻辣', '香菜', '减肥', '低卡'];

const ALLERGY_PENALTY = {
  '辣': 15,
  '麻辣': 15,
  '香菜': 12,
  '素食': 25,
  '减肥': 10,
  '低卡': 10,
};

const ALLERGY_TRAIT_MAP = {
  '辣': 'spicy',
  '麻辣': 'spicy',
  '香菜': 'cilantro',
  '减肥': 'heavy',
  '低卡': 'heavy',
};

const RESTAURANT_TRAIT_MAP = {
  'spicy': ['辣', '川', '湘', '麻辣', '重庆', '火锅', '串串', '冒菜', '麻辣烫', '韩国', '韩式', '泰国', '东南亚', '泰', '云南'],
  'seafood': ['海鲜', '鱼', '虾', '蟹', '日料', '寿司', '刺身', '日式', '广东', '广式', '潮汕', '粤菜'],
  'meat': ['烤肉', '烧烤', '烤串', '撸串', '牛排', '汉堡', '炸鸡', '北京菜', '火锅', '自助', '韩式', '西餐'],
  'heavy': ['火锅', '烤肉', '烧烤', '自助', '汉堡', '炸鸡', '甜品', '蛋糕', '披萨'],
  'vegetarian_friendly': ['素食', '素菜', '沙拉', '轻食', '健康餐', '菌菇', '豆制品', '蔬菜'],
  'fast': ['快餐', '面馆', '米线', '拉面', '小吃', '便当', '定食'],
  'slow': ['火锅', '烤肉', '西餐', '日料', '自助餐'],
  'hot': ['火锅', '汤', '砂锅', '麻辣烫', '冒菜', '串串'],
  'cold': ['沙拉', '轻食', '日料', '冷面', '冰淇淋', '甜品'],
};

function restaurantHasTrait(restaurant, trait) {
  const keywords = RESTAURANT_TRAIT_MAP[trait] || [];
  const allText = [...(restaurant.tags || []), ...(restaurant.features || []), restaurant.cuisine || '', restaurant.name || ''].join('');
  return keywords.some(kw => allText.includes(kw));
}

const COMPROMISE_RULES = [
  {
    match: (conflict) => conflict.allergy === '辣',
    keywords: ['不辣', '微辣', '鸳鸯', '清汤', '新派', '改良', '去辣', '清淡'],
  },
  {
    match: (conflict) => conflict.allergy === '素食',
    keywords: ['素', '素菜', '菌菇', '豆制品', '轻食', '沙拉', '蔬菜'],
  },
  {
    match: (conflict) => conflict.allergy === '海鲜',
    keywords: ['拉面', '定食', '饭', '面', '肉'],
  },
  {
    match: (conflict) => conflict.allergy === '减肥' || conflict.allergy === '低卡',
    keywords: ['轻食', '低卡', '健康', '素', '沙拉', '少糖', '低脂'],
  },
];

function checkCompromise(restaurant, conflict) {
  const allText = [...(restaurant.tags || []), ...(restaurant.features || []), restaurant.cuisine || ''].join('');

  for (const rule of COMPROMISE_RULES) {
    if (rule.match(conflict)) {
      return rule.keywords.some(kw => allText.includes(kw));
    }
  }
  return false;
}

export function filterByAllergies(restaurants, allergies, conflicts = []) {
  if (!allergies || allergies.length === 0) {
    return restaurants;
  }

  const hardConflictKeywords = new Set();
  conflicts.forEach(c => {
    if (c.type === 'hard') {
      hardConflictKeywords.add(c.preference);
    }
  });

  return restaurants.filter(restaurant => {
    for (const allergy of allergies) {
      if (!HARD_ALLERGIES.includes(allergy)) continue;

      let violates = false;

      if (allergy === '素食') {
        violates = restaurantHasTrait(restaurant, 'meat');
      } else if (allergy === '海鲜') {
        violates = restaurantHasTrait(restaurant, 'seafood');
      } else if (allergy === '清真') {
        const allTags = [...(restaurant.tags || []), ...(restaurant.features || []), restaurant.cuisine || ''].join('');
        violates = !allTags.includes('清真');
      } else if (allergy === '坚果') {
        const allTags = [...(restaurant.tags || []), ...(restaurant.features || []), restaurant.cuisine || ''].join('');
        violates = allTags.includes('坚果');
      } else if (allergy === '花生') {
        const allTags = [...(restaurant.tags || []), ...(restaurant.features || []), restaurant.cuisine || ''].join('');
        violates = allTags.includes('花生');
      }

      if (violates) return false;
    }

    for (const kw of hardConflictKeywords) {
      const allText = [...(restaurant.tags || []), ...(restaurant.features || []), restaurant.cuisine || ''].join('');
      if (allText.includes(kw)) {
        return false;
      }
    }

    return true;
  });
}

// ============ 单成员评分 ============

/**
 * 计算单个成员对餐厅的评分
 */
export function calculateMemberScore(restaurant, member) {
  let score = 0;
  const reasons = [];
  let penalty = 0;

  const allFeatures = [...(restaurant.tags || []), ...(restaurant.features || []), restaurant.cuisine || '', restaurant.name || ''];
  const cuisineFeatures = [...(restaurant.tags || []), ...(restaurant.features || []), restaurant.cuisine || '', restaurant.name || ''];
  const allText = allFeatures.join('');

  // 1. 偏好匹配
  if (member.preferences && member.preferences.length > 0) {
    let exactMatches = 0;
    let partialMatches = 0;

    member.preferences.forEach(pref => {
      const exactMatch = cuisineFeatures.some(f => f === pref);
      // 子串匹配：限制 tag 长度差 <= 4，防止菜品标签误判
      const substringMatch = !exactMatch && cuisineFeatures.some(f =>
        (f.includes(pref) && (f.length - pref.length) <= 4) ||
        (pref.includes(f) && f.length >= 2)
      );
      const partialMatch = !exactMatch && !substringMatch && checkPrefMatch(pref, cuisineFeatures);
      if (exactMatch) exactMatches++;
      else if (partialMatch || substringMatch) partialMatches++;
    });

    const matchRate = (exactMatches + partialMatches * 0.7) / member.preferences.length;
    const baseScore = 55;
    const bonusScore = 45 * powerScale(matchRate, 1.8);
    const cuisineScore = baseScore + bonusScore;
    score += cuisineScore * WEIGHTS.cuisine;

    if (exactMatches > 0 || partialMatches > 0) {
      const matched = member.preferences.filter(pref => checkPrefMatch(pref, cuisineFeatures));
      // 子串匹配（如韩式烤肉→烤肉）在展示上视为契合，但不影响评分
      const hasSubstring = member.preferences.some(pref =>
        cuisineFeatures.some(f =>
          (f.includes(pref) && (f.length - pref.length) <= 4) ||
          (pref.includes(f) && f.length >= 2)
        )
      );
      reasons.push({
        type: (exactMatches > 0 || hasSubstring) ? 'match' : 'partial',
        text: (exactMatches > 0 || hasSubstring)
          ? `${member.name}：想吃${matched.join('、')}，完美契合`
          : `${member.name}：想吃${matched.join('、')}，部分契合`
      });
    }
  } else {
    score += 70 * WEIGHTS.cuisine;
  }

  // 2. 软约束忌口检测
  if (member.allergies && member.allergies.length > 0) {
    member.allergies.forEach(allergy => {
      const isSoft = SOFT_ALLERGIES.includes(allergy);
      const isStrongSoft = STRONG_SOFT_ALLERGIES.includes(allergy);
      if (!isSoft && !isStrongSoft) return;

      if (allergy === '素食') {
        const hasMeat = restaurantHasTrait(restaurant, 'meat');
        const hasVegFriendly = restaurantHasTrait(restaurant, 'vegetarian_friendly');
        if (hasMeat) {
          let penaltyAmount = ALLERGY_PENALTY['素食'] || 25;
          if (hasVegFriendly) {
            penaltyAmount = Math.floor(penaltyAmount * 0.4);
            reasons.push({ type: 'partial', text: `${member.name}：有素菜可选，扣分较少` });
          } else {
            reasons.push({ type: 'mismatch', text: `${member.name}：以肉食为主，扣分` });
          }
          penalty += penaltyAmount;
        }
      } else {
        const trait = ALLERGY_TRAIT_MAP[allergy];
        if (!trait) return;

        if (restaurantHasTrait(restaurant, trait)) {
          const penaltyAmount = ALLERGY_PENALTY[allergy] || 10;
          penalty += penaltyAmount;
          reasons.push({ type: 'mismatch', text: `${member.name}：含${allergy}相关，扣分` });
        }
      }
    });
  }

  // 3. 预算
  if (member.budget && restaurant.price) {
    const ratio = restaurant.price / member.budget;
    let budgetScore;
    if (ratio <= 1) {
      budgetScore = 85 + (1 - (1 - ratio) * 0.3) * 15;
      reasons.push({ type: 'match', text: `${member.name}：预算内` });
    } else if (ratio <= 1.2) {
      budgetScore = 70 - (ratio - 1) * 100;
      reasons.push({ type: 'partial', text: `${member.name}：略超预算` });
    } else {
      budgetScore = Math.max(40, 60 - (ratio - 1.2) * 30);
      reasons.push({ type: 'mismatch', text: `${member.name}：超预算` });
    }
    score += budgetScore * WEIGHTS.budget;
  } else {
    score += 75 * WEIGHTS.budget;
  }

  // 4. 距离
  const distance = restaurant.distance || 10;
  const distanceScore = Math.exp(-distance / 20) * 100;
  score += distanceScore * WEIGHTS.distance;

  // 5. 评分
  const rating = restaurant.rating || 4.2;
  const ratingScore = 60 + powerScale((rating - 3.5) / 1.5, 1.2) * 40;
  score += Math.max(60, Math.min(100, ratingScore)) * WEIGHTS.rating;

  // 6. 人气
  const reviewCount = restaurant.reviewCount || 0;
  const popularityScore = Math.min(100, 55 + Math.log10(reviewCount + 1) * 18);
  score += popularityScore * WEIGHTS.popularity;

  // 7. 价格合理性
  const price = restaurant.price || 50;
  const idealPrice = 50;
  const priceFitScore = Math.max(50, 100 - Math.abs(price - idealPrice) * 0.5);
  score += priceFitScore * WEIGHTS.priceFit;

  // 8. 新鲜感
  const reviewCountRaw = restaurant.reviewCount || 0;
  const freshnessScore = (reviewCountRaw > 0 && reviewCountRaw < 500)
    ? 70 + ((500 - reviewCountRaw) / 500) * 25
    : 55;
  score += freshnessScore * WEIGHTS.novelty;

  // 9. 季节适配（权重为0）
  const season = getSeason();
  let seasonFitScore = 60;
  if ((season === 'winter' || season === 'autumn') && restaurantHasTrait(restaurant, 'hot')) {
    seasonFitScore = 90;
  } else if ((season === 'summer' || season === 'spring') && restaurantHasTrait(restaurant, 'cold')) {
    seasonFitScore = 88;
  } else if ((season === 'winter' || season === 'autumn') && restaurantHasTrait(restaurant, 'cold')) {
    seasonFitScore = 45;
  } else if ((season === 'summer' || season === 'spring') && restaurantHasTrait(restaurant, 'hot')) {
    seasonFitScore = 45;
  }
  score += seasonFitScore * WEIGHTS.seasonFit;

  // 10. 时段适配（权重为0）
  const timeSlot = getTimeSlot();
  let timeFitScore = 62;
  if (timeSlot === 'breakfast' && restaurantHasTrait(restaurant, 'fast')) {
    timeFitScore = 90;
  } else if (timeSlot === 'lunch' && restaurantHasTrait(restaurant, 'fast')) {
    timeFitScore = 85;
  } else if (timeSlot === 'dinner' && restaurantHasTrait(restaurant, 'slow')) {
    timeFitScore = 85;
  } else if (timeSlot === 'afternoon' && (restaurant.cuisine || '').includes('咖啡')) {
    timeFitScore = 90;
  } else if (timeSlot === 'late_night' && (restaurant.cuisine || '').includes('烧烤')) {
    timeFitScore = 90;
  }
  score += powerScale(timeFitScore / 100, 1.2) * WEIGHTS.timeFit * 100;

  // 应用软约束惩罚
  score = Math.max(0, score - penalty);

  // 确保每个成员至少有一条原因显示
  if (reasons.length === 0) {
    const hasPrefs = member.preferences && member.preferences.length > 0;
    if (hasPrefs) {
      reasons.push({ type: 'mismatch', text: `${member.name}：想吃${member.preferences.join('、')}，做法差异较大` });
    } else {
      reasons.push({ type: 'match', text: `${member.name}：无特殊偏好，餐厅适合` });
    }
  }

  return { score: Math.round(score * 10) / 10, reasons };
}

// ============ 群体评分 ============

function dedupeReasons(reasons) {
  const seen = new Set();
  return reasons.filter(r => {
    const key = r.text;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * 计算餐厅对群体的综合评分
 */
export function calculateGroupScore(restaurant, intent) {
  if (!intent.members || intent.members.length === 0) {
    return calculateSingleScore(restaurant, intent);
  }

  const memberScores = [];
  let allReasons = [];
  let satisfiedMembers = 0;
  let verySatisfiedMembers = 0;
  let unhappyMembers = 0;
  const memberReasonsMap = {};

  // 收集所有成员的偏好
  const allPreferences = [];
  intent.members.forEach(member => {
    if (member.preferences && member.preferences.length > 0) {
      member.preferences.forEach(pref => {
        allPreferences.push({ pref, memberName: member.name });
      });
    }
  });

  const allFeatures = [...(restaurant.tags || []), ...(restaurant.features || []), restaurant.cuisine || '', restaurant.name || ''];
  const cuisineFeatures = [...(restaurant.tags || []), ...(restaurant.features || []), restaurant.cuisine || '', restaurant.name || ''];
  const fusionCheckFeatures = [
    ...(restaurant.tags || []),
    ...(restaurant.features || []),
    restaurant.cuisine || '',
    restaurant.name || '',
  ];

  // 检查跨成员偏好融合
  const fusionResults = [];
  if (allPreferences.length >= 2) {
    for (let i = 0; i < allPreferences.length; i++) {
      for (let j = i + 1; j < allPreferences.length; j++) {
        const pref1 = allPreferences[i].pref;
        const pref2 = allPreferences[j].pref;
        if (allPreferences[i].memberName === allPreferences[j].memberName) continue;
        
        const fusion = checkFusion(pref1, pref2, fusionCheckFeatures);
        if (fusion.canFusion) {
          fusionResults.push({
            ...fusion,
            pref1,
            pref2,
            member1: allPreferences[i].memberName,
            member2: allPreferences[j].memberName,
          });
        }
      }
    }
  }

  intent.members.forEach(member => {
    const { score, reasons: memberReasons } = calculateMemberScore(restaurant, member);
    memberScores.push({ member, score });
    const hasMismatch = memberReasons.some(r => r.type === 'mismatch');
    if (!hasMismatch) satisfiedMembers++;
    if (score >= 80) verySatisfiedMembers++;
    if (score < 40) unhappyMembers++;
    
    // 存储成员原因，后面根据融合情况再决定是否显示
    memberReasonsMap[member.name] = memberReasons;
  });

  const scores = memberScores.map(m => m.score);
  const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const scoreSpread = maxScore - minScore;

  const variance = scores.reduce((sum, s) => sum + Math.pow(s - avgScore, 2), 0) / scores.length;
  const stdDev = Math.sqrt(variance);

  const powerAvg = powerScale(avgScore / 100, 1.3) * 100;
  const minPenalty = minScore < 50 ? powerScale((50 - minScore) / 50, 1.3) * 12 : 0;
  const stdPenalty = stdDev > 15 ? powerScale((stdDev - 15) / 35, 1.3) * 8 : 0;
  const unhappyPenalty = unhappyMembers > 0 ? unhappyMembers * 6 : 0;

  let groupScore = powerAvg - minPenalty - stdPenalty - unhappyPenalty;

  if (stdDev < 10) {
    const consistencyBonus = powerScale((10 - stdDev) / 10, 1.3) * 6;
    groupScore += consistencyBonus;
  }

  if (verySatisfiedMembers > 0) {
    const excellenceBonus = verySatisfiedMembers * 3;
    groupScore += excellenceBonus;
  }

  if (satisfiedMembers === intent.members.length) {
    groupScore += 10;
  }

  // 融合加分
  if (fusionResults.length > 0) {
    const perfectFusions = fusionResults.filter(f => f.fusionType === 'perfect');
    const flavorFusions = fusionResults.filter(f => f.fusionType === 'flavor');
    const styleFusions = fusionResults.filter(f => f.fusionType === 'style');

    let fusionHeader = null;
    let fusionDetails = [];

    if (perfectFusions.length > 0) {
      groupScore += perfectFusions.length * 8;
      const fusion = perfectFusions[0];
      fusionHeader = { type: 'fusion', fusionType: 'perfect', text: `完美融合！同时满足两人的偏好` };
      fusionDetails = [
        { type: 'fusion-detail', fusionType: 'perfect', memberName: fusion.member1, text: fusion.member1Reason },
        { type: 'fusion-detail', fusionType: 'perfect', memberName: fusion.member2, text: fusion.member2Reason },
      ];
    } else if (flavorFusions.length > 0) {
      groupScore += flavorFusions.length * 4;
      const fusion = flavorFusions[0];
      fusionHeader = { type: 'fusion', fusionType: 'flavor', text: `口味融合` };
      fusionDetails = [
        { type: 'fusion-detail', fusionType: 'flavor', memberName: fusion.member1, text: fusion.member1Reason },
        { type: 'fusion-detail', fusionType: 'flavor', memberName: fusion.member2, text: fusion.member2Reason },
      ];
    } else if (styleFusions.length > 0) {
      groupScore += styleFusions.length * 2;
      const fusion = styleFusions[0];
      fusionHeader = { type: 'fusion', fusionType: 'style', text: `形式融合` };
      fusionDetails = [
        { type: 'fusion-detail', fusionType: 'style', memberName: fusion.member1, text: fusion.member1Reason },
        { type: 'fusion-detail', fusionType: 'style', memberName: fusion.member2, text: fusion.member2Reason },
      ];
    }

    // 融合详情已说明偏好匹配，只保留非偏好类原因（预算、忌口等）
    intent.members.forEach(member => {
      const reasons = memberReasonsMap[member.name] || [];
      const nonPrefReasons = reasons.filter(r => !r.text.includes('想吃'));
      allReasons = allReasons.concat(nonPrefReasons);
    });

    // 融合标题 → 融合详情（成员1→成员2顺序）→ 成员原因
    if (fusionHeader) {
      allReasons.unshift(fusionHeader);
    }
    allReasons = [...fusionDetails, ...allReasons];
  } else {
    // 没有融合，直接添加所有成员原因
    intent.members.forEach(member => {
      const reasons = memberReasonsMap[member.name] || [];
      allReasons = allReasons.concat(reasons);
    });
  }

  if (intent.conflicts && intent.conflicts.length > 0) {
    let resolvedCount = 0;
    const totalConflicts = intent.conflicts.length;

    intent.conflicts.forEach(conflict => {
      const hasCompromise = checkCompromise(restaurant, conflict);
      if (hasCompromise) {
        resolvedCount++;
        allReasons.push({
          type: 'match',
          text: `冲突化解：${conflict.resolution}`
        });
      }
    });

    groupScore += resolvedCount * 5;

    if (resolvedCount === totalConflicts && totalConflicts > 0) {
      groupScore += 10;
      allReasons.push({ type: 'match', text: '完美解决所有冲突！' });
    }
  }

  const memberCount = intent.members.length;
  if (memberCount >= 3) {
    const groupBonus = Math.min(8, (memberCount - 2) * 2);
    groupScore += groupBonus;
  }

  groupScore = stretchScore(groupScore);

  if (intent.members.length > 1) {
    const unsatisfiedCount = intent.members.length - satisfiedMembers;
    let summaryText;
    if (satisfiedMembers === intent.members.length) {
      summaryText = `全部满足！${verySatisfiedMembers > 0 ? `（${verySatisfiedMembers}位非常满意）` : ''}`;
    } else if (satisfiedMembers === 0) {
      summaryText = `暂未匹配到合适的选择`;
    } else {
      summaryText = `满足 ${satisfiedMembers}/${intent.members.length} 位成员`;
      if (unsatisfiedCount > 0) {
        summaryText += `，${unsatisfiedCount}位未匹配`;
      }
      if (verySatisfiedMembers > 0) {
        summaryText += `（${verySatisfiedMembers}位非常满意）`;
      }
    }
    allReasons.unshift({
      type: 'group',
      satisfiedCount: satisfiedMembers,
      totalCount: intent.members.length,
      text: summaryText
    });

    if (scoreSpread > 35) {
      allReasons.push({
        type: 'mismatch',
        text: `成员满意度差异大（${Math.round(minScore)} vs ${Math.round(maxScore)}）`
      });
    }

    if (unhappyMembers > 0) {
      allReasons.push({
        type: 'mismatch',
        text: `${unhappyMembers}位成员不太满意`
      });
    }
  }

  if (typeof groupScore !== 'number' || isNaN(groupScore) || !isFinite(groupScore)) {
    groupScore = 75;
  }

  return { score: groupScore, reasons: dedupeReasons(allReasons) };
}

// ============ 单人评分（向后兼容） ============

export function calculateScore(restaurant, intent) {
  return calculateSingleScore(restaurant, intent);
}

export function calculateSingleScore(restaurant, intent) {
  let score = 0;
  const reasons = [];

  // 1. 偏好匹配
  if (intent.preferences && intent.preferences.length > 0) {
    let exactMatches = 0;
    let partialMatches = 0;
    const allFeatures = [...(restaurant.tags || []), ...(restaurant.features || []), restaurant.cuisine || '', restaurant.name || ''];

    intent.preferences.forEach(pref => {
      const exactMatch = allFeatures.some(f => f === pref);
      const substringMatch = !exactMatch && allFeatures.some(f => f.includes(pref) || pref.includes(f));
      const partialMatch = !exactMatch && !substringMatch && checkPrefMatch(pref, allFeatures);
      if (exactMatch) exactMatches++;
      else if (partialMatch || substringMatch) partialMatches++;
    });

    const matchRate = (exactMatches + partialMatches * 0.7) / intent.preferences.length;
    const baseScore = 55;
    const bonusScore = 45 * powerScale(matchRate, 1.8);
    score += (baseScore + bonusScore) * WEIGHTS.cuisine;

    const matched = intent.preferences.filter(pref => checkPrefMatch(pref, allFeatures));
    if (exactMatches > 0 || partialMatches > 0) {
      const hasSubstring = intent.preferences.some(pref =>
        allFeatures.some(f =>
          (f.includes(pref) && (f.length - pref.length) <= 4) ||
          (pref.includes(f) && f.length >= 2)
        )
      );
      reasons.push({
        type: (exactMatches > 0 || hasSubstring) ? 'match' : 'partial',
        text: `想吃${matched.join('、')}`
      });
    }
  } else {
    score += WEIGHTS.cuisine * 70;
  }

  // 2. 预算
  if (intent.budget && restaurant.price) {
    const ratio = restaurant.price / intent.budget;
    if (ratio <= 1) {
      const budgetScore = 100 - (1 - ratio) * 15;
      score += budgetScore * WEIGHTS.budget;
      reasons.push({ type: 'match', text: `人均${restaurant.price}元 — 在预算内` });
    } else if (ratio <= 1.1) {
      const overScore = 80 - (ratio - 1) * 100;
      score += overScore * WEIGHTS.budget;
      reasons.push({ type: 'partial', text: `人均${restaurant.price}元 — 略超预算` });
    } else {
      const overScore = Math.max(25, 70 - (ratio - 1.1) * 25);
      score += overScore * WEIGHTS.budget;
      reasons.push({ type: 'mismatch', text: `人均${restaurant.price}元 — 超出预算较多` });
    }
  } else if (intent.priceRange) {
    const [minP, maxP] = intent.priceRange;
    if (restaurant.price && restaurant.price > 0) {
      const inRange = maxP >= 200 ? restaurant.price >= minP : (restaurant.price >= minP && restaurant.price <= maxP);
      if (inRange) {
        score += WEIGHTS.budget * 85;
        reasons.push({ type: 'match', text: `人均${restaurant.price}元 — 在预算范围内` });
      } else {
        score += WEIGHTS.budget * 30;
        reasons.push({ type: 'mismatch', text: `人均${restaurant.price}元 — 超出预算范围` });
      }
    } else {
      score += WEIGHTS.budget * 40;
      reasons.push({ type: 'partial', text: '价格信息缺失' });
    }
  } else {
    score += WEIGHTS.budget * 75;
  }

  // 3. 距离
  const distance = restaurant.distance || 10;
  const distanceScore = Math.exp(-distance / 20) * 100;
  score += distanceScore * WEIGHTS.distance;

  if (distance <= 5) {
    reasons.push({ type: 'match', text: `步行${distance}分钟 — 很近` });
  } else if (distance <= 15) {
    reasons.push({ type: 'match', text: `步行${distance}分钟 — 距离适中` });
  } else {
    reasons.push({ type: 'partial', text: `步行${distance}分钟 — 稍远` });
  }

  // 4. 评分
  const rating = restaurant.rating || 4.2;
  const ratingScore = 60 + powerScale((rating - 3.5) / 1.5, 1.2) * 40;
  score += Math.max(60, Math.min(100, ratingScore)) * WEIGHTS.rating;

  // 5. 人气
  const reviewCount = restaurant.reviewCount || 0;
  const popularityScore = Math.min(100, 50 + Math.log10(reviewCount + 1) * 20);
  score += popularityScore * WEIGHTS.popularity;

  if (reviewCount >= 1000) {
    reasons.push({ type: 'match', text: `${reviewCount}+评价 — 口碑验证` });
  } else if (reviewCount >= 500) {
    reasons.push({ type: 'partial', text: `${reviewCount}+评价 — 有一定人气` });
  }

  // 6. 价格合理性
  const price = restaurant.price || 50;
  const idealPrice = 50;
  const priceFitScore = Math.max(40, 100 - Math.abs(price - idealPrice) * 0.6);
  score += priceFitScore * WEIGHTS.priceFit;

  if (typeof score !== 'number' || isNaN(score) || !isFinite(score)) {
    score = 60;
  }

  return {
    score: stretchScore(score),
    reasons,
  };
}

// ============ 菜系搜索 & 多样性平衡 ============

export function getCuisineSearchKeys(intent) {
  if (intent.searchKeyword) {
    return intent.searchKeyword.split('|').filter(k => k.trim());
  }

  const prefs = intent.preferences || [];
  const cuisineSet = new Set();
  prefs.forEach(p => {
    if (Object.keys(CUISINE_SEMANTIC_MAP).includes(p)) cuisineSet.add(p);
    Object.values(CUISINE_KEYWORDS_FOR_FILTER).forEach(arr => {
      if (arr.includes(p)) cuisineSet.add(p);
    });
  });
  return [...cuisineSet];
}

/**
 * 生成菜系融合搜索关键词
 * 根据多个成员的菜系偏好，生成可能融合的餐厅关键词
 * 例如: 川菜 + 火锅 → ['麻辣火锅', '川味火锅', '火锅冒菜']
 * 同时添加通用 fallback 关键词确保能搜到足够候选
 */
export function getFusionSearchKeywords(intent) {
  if (!intent.preferences || intent.preferences.length < 2) {
    return [];
  }

  const preferences = [...new Set(intent.preferences)];
  const fusionKeywords = new Set();

  for (let i = 0; i < preferences.length; i++) {
    for (let j = i + 1; j < preferences.length; j++) {
      const pref1 = preferences[i];
      const pref2 = preferences[j];

      if ((pref1 === '川菜' && pref2 === '火锅') || (pref1 === '火锅' && pref2 === '川菜')) {
        ['麻辣火锅', '川味火锅', '四川火锅', '重庆火锅', '火锅冒菜', '麻辣烫'].forEach(k => fusionKeywords.add(k));
      }
      if ((pref1 === '川菜' && pref2 === '冒菜') || (pref1 === '冒菜' && pref2 === '川菜')) {
        ['麻辣冒菜', '川式冒菜', '冒菜'].forEach(k => fusionKeywords.add(k));
      }
      if ((pref1 === '火锅' && pref2 === '冒菜') || (pref1 === '冒菜' && pref2 === '火锅')) {
        ['火锅冒菜', '麻辣烫', '串串'].forEach(k => fusionKeywords.add(k));
      }
      if ((pref1 === '川菜' && pref2 === '湘菜') || (pref1 === '湘菜' && pref2 === '川菜')) {
        ['川湘菜'].forEach(k => fusionKeywords.add(k));
      }
      if ((pref1 === '日料' && pref2 === '烧鸟') || (pref1 === '烧鸟' && pref2 === '日料')) {
        ['日式烧鸟', '居酒屋', '烧鸟'].forEach(k => fusionKeywords.add(k));
      }
      if ((pref1 === '烤肉' && pref2 === '烧烤') || (pref1 === '烧烤' && pref2 === '烤肉')) {
        ['韩式烤肉', '日式烤肉', '自助烤肉'].forEach(k => fusionKeywords.add(k));
      }
      if ((pref1 === '火锅' || pref2 === '火锅') && (pref1 === '烧烤' || pref2 === '烧烤' || pref1 === '烤肉' || pref2 === '烤肉')) {
        ['火锅烧烤', '烤肉火锅', '火锅烤肉', '涮烤', '烧烤火锅', '涮烤自助', '自助烧烤火锅', '火锅烤肉自助'].forEach(k => fusionKeywords.add(k));
      }
      if ((pref1 === '韩餐' || pref2 === '韩餐') && (pref1 === '烧烤' || pref2 === '烧烤' || pref1 === '烤肉' || pref2 === '烤肉')) {
        ['韩式烧烤', '韩式烤肉', '韩国烤肉'].forEach(k => fusionKeywords.add(k));
      }
      if ((pref1 === '韩餐' || pref2 === '韩餐') && (pref1 === '火锅' || pref2 === '火锅')) {
        ['部队锅', '韩式火锅', '部队火锅'].forEach(k => fusionKeywords.add(k));
      }
      if ((pref1 === '日料' || pref2 === '日料') && (pref1 === '火锅' || pref2 === '火锅')) {
        ['寿喜烧', '日式火锅', '涮涮锅', '日式涮锅'].forEach(k => fusionKeywords.add(k));
      }
      if ((pref1 === '粤菜' || pref2 === '粤菜') && (pref1 === '火锅' || pref2 === '火锅')) {
        ['打边炉', '粤式火锅', '粥底火锅', '猪肚鸡'].forEach(k => fusionKeywords.add(k));
      }
      if ((pref1 === '粤菜' || pref2 === '粤菜') && (pref1 === '烧烤' || pref2 === '烧烤' || pref1 === '烤肉' || pref2 === '烤肉')) {
        ['烧腊', '叉烧', '广式烧腊', '烧鹅'].forEach(k => fusionKeywords.add(k));
      }
      if ((pref1 === '东北菜' || pref2 === '东北菜') && (pref1 === '烧烤' || pref2 === '烧烤' || pref1 === '烤肉' || pref2 === '烤肉')) {
        ['东北烧烤', '东北烤肉'].forEach(k => fusionKeywords.add(k));
      }
      if ((pref1 === '新疆菜' || pref2 === '新疆菜') && (pref1 === '烧烤' || pref2 === '烧烤' || pref1 === '烤肉' || pref2 === '烤肉')) {
        ['新疆烤肉', '羊肉串', '新疆烧烤', '烤羊肉'].forEach(k => fusionKeywords.add(k));
      }
      if ((pref1 === '湘菜' || pref2 === '湘菜') && (pref1 === '烧烤' || pref2 === '烧烤' || pref1 === '烤肉' || pref2 === '烤肉')) {
        ['湘味烧烤', '湖南烤肉', '湖南烧烤'].forEach(k => fusionKeywords.add(k));
      }
      if ((pref1 === '湘菜' || pref2 === '湘菜') && (pref1 === '火锅' || pref2 === '火锅')) {
        ['湘味火锅', '湖南火锅'].forEach(k => fusionKeywords.add(k));
      }
      // 川菜相关组合需要另一方与烧烤/火锅有关联时才触发，而非无条件
      if ((pref1 === '川菜' || pref2 === '川菜') && (pref1 === '烧烤' || pref2 === '烧烤' || pref1 === '烤肉' || pref2 === '烤肉' || pref1 === '火锅' || pref2 === '火锅')) {
        ['烤鱼', '麻辣烤鱼', '巫山烤鱼', '麻辣烧烤'].forEach(k => fusionKeywords.add(k));
      }
      if ((pref1 === '川菜' || pref2 === '川菜' || pref1 === '江浙菜' || pref2 === '江浙菜') && (pref1 === '火锅' || pref2 === '火锅' || pref1 === '烧烤' || pref2 === '烧烤')) {
        ['酸菜鱼', '太二酸菜鱼'].forEach(k => fusionKeywords.add(k));
      }
    }
  }

  return [...fusionKeywords];
}

export function balanceDiversity(scoredRestaurants, intent) {
  if (!intent.members || intent.members.length < 2) {
    return scoredRestaurants;
  }

  const memberPreferences = intent.members.map(m => m.preferences || []);
  const allPrefs = new Set(memberPreferences.flat());
  if (allPrefs.size <= 1) {
    return scoredRestaurants;
  }

  const cuisinePrefs = [...allPrefs].filter(p =>
    Object.keys(CUISINE_SEMANTIC_MAP).includes(p) ||
    Object.values(CUISINE_KEYWORDS_FOR_FILTER).some(kw => kw.includes(p))
  );
  if (cuisinePrefs.length <= 1) {
    return scoredRestaurants;
  }

  const fusion = [];
  const categorized = {};
  cuisinePrefs.forEach(p => categorized[p] = []);
  const others = [];
  const usedIds = new Set();

  scoredRestaurants.forEach(r => {
    const allFeatures = [...(r.tags || []), ...(r.features || []), r.cuisine || ''];
    const matchedPrefs = cuisinePrefs.filter(p => checkPrefMatch(p, allFeatures));

    if (matchedPrefs.length >= 2) {
      fusion.push(r);
    } else if (matchedPrefs.length === 1) {
      categorized[matchedPrefs[0]].push(r);
    } else {
      others.push(r);
    }
  });

  const TOTAL = 5;
  const result = [];
  const pushUnique = (r) => {
    if (r && !usedIds.has(r.id)) { usedIds.add(r.id); result.push(r); return true; }
    return false;
  };

  fusion.slice(0, 2).forEach(r => pushUnique(r));

  cuisinePrefs.forEach(pref => {
    if (result.length >= TOTAL) return;
    const pool = categorized[pref] || [];
    for (const r of pool) {
      if (pushUnique(r)) break;
    }
  });

  let prefIdx = 0;
  while (result.length < TOTAL) {
    let added = false;
    for (let i = 0; i < cuisinePrefs.length; i++) {
      if (result.length >= TOTAL) break;
      const pref = cuisinePrefs[(prefIdx + i) % cuisinePrefs.length];
      const pool = categorized[pref] || [];
      const next = pool.find(r => !usedIds.has(r.id));
      if (next && pushUnique(next)) { added = true; prefIdx = (prefIdx + i + 1) % cuisinePrefs.length; break; }
    }
    if (!added) break;
  }

  for (const r of others) {
    if (result.length >= TOTAL) break;
    pushUnique(r);
  }

  for (const r of scoredRestaurants) {
    if (result.length >= TOTAL) break;
    pushUnique(r);
  }

  return result;
}

// ============ 空结果分析 ============

export function analyzeEmptyResult(intent, currentRadius = 3000) {
  const suggestions = [];
  const prefs = intent.preferences || [];
  const allergies = intent.allergies || [];
  const budget = intent.budget;
  const cuisinePrefs = prefs.filter(p =>
    Object.keys(CUISINE_SEMANTIC_MAP).includes(p) ||
    Object.values(CUISINE_KEYWORDS_FOR_FILTER).some(arr => arr.includes(p))
  );

  if (cuisinePrefs.length > 0) {
    const cuisine = cuisinePrefs[0];
    const similarCuisines = SIMILAR_CUISINES[cuisine] || [];
    if (similarCuisines.length > 0) {
      const altCuisine = similarCuisines[0];
      suggestions.push({
        id: 'similar_cuisine',
        text: `附近${cuisine}店不多，要不要试试${altCuisine}？`,
        type: 'similar_cuisine',
        icon: 'utensils',
        action: { type: 'replace_cuisine', from: cuisine, to: altCuisine }
      });
    }
  }

  if (currentRadius < 5000) {
    let nextRadius, distanceText;
    if (currentRadius <= 1000) { nextRadius = 3000; distanceText = '3km'; }
    else if (currentRadius <= 3000) { nextRadius = 5000; distanceText = '5km'; }
    else { nextRadius = 8000; distanceText = '全城'; }
    suggestions.push({
      id: 'expand_distance',
      text: `扩大搜索范围到${distanceText}？`,
      type: 'expand_distance',
      icon: 'map-pin',
      action: { type: 'expand_radius', radius: nextRadius }
    });
  }

  if (budget && budget > 0 && budget < 150) {
    const relaxedBudget = Math.min(Math.round(budget * 1.5), 200);
    suggestions.push({
      id: 'relax_budget',
      text: `预算放宽到 ${relaxedBudget} 元/人？`,
      type: 'relax_budget',
      icon: 'wallet',
      action: { type: 'set_budget', budget: relaxedBudget }
    });
  }

  if (allergies.length >= 2) {
    suggestions.push({
      id: 'fewer_allergies',
      text: `忌口有点多，要不要先去掉 ${allergies[allergies.length - 1]}？`,
      type: 'fewer_allergies',
      icon: 'ban',
      action: { type: 'remove_allergy', allergy: allergies[allergies.length - 1] }
    });
  }

  suggestions.push({
    id: 'show_all',
    text: '不挑了，看看附近所有餐厅',
    type: 'show_all',
    icon: 'sparkles',
    action: { type: 'clear_preferences' }
  });

  return suggestions.slice(0, 4);
}

// ============ 搜索关键词扩展 ============

/**
 * 获取菜系偏好的扩展搜索关键词（用于高德地图POI搜索）
 * 将单个菜系偏好展开为多个相关搜索词，解决烤涮一体等跨菜系餐厅因标签不匹配而搜不到的问题
 * 例如："烤肉" → "烤肉|烧烤|韩式烤肉|日式烤肉|烧肉"
 * 高德API keywords 参数支持 | 分隔的OR搜索
 */
export function getExpandedSearchKeyword(cuisine) {
  const expansionMap = {
    '烤肉': ['烤肉', '韩式烤肉', '日式烤肉', '烧肉', '韩国烤肉'],
    '烧烤': ['烧烤', '烤串', '羊肉串', '烤生蚝', '烤鱼', '撸串'],
    '火锅': ['火锅', '涮锅', '麻辣烫', '串串', '铜锅', '涮肉', '打边炉'],
    '川菜': ['川菜', '四川菜', '重庆菜', '川味', '麻辣'],
    '湘菜': ['湘菜', '湖南菜', '湘味'],
    '粤菜': ['粤菜', '广东菜', '广式', '茶餐厅', '烧腊', '潮汕'],
    '日料': ['日料', '日本料理', '日式', '寿司', '居酒屋', '定食'],
    '韩餐': ['韩餐', '韩国料理', '韩式', '韩国烤肉', '部队锅'],
    '东北菜': ['东北菜', '东北', '锅包肉', '杀猪菜'],
    '新疆菜': ['新疆菜', '新疆', '大盘鸡', '羊肉串', '烤羊肉'],
    '江浙菜': ['江浙菜', '本帮菜', '杭帮菜', '上海菜', '淮扬菜'],
    '海鲜': ['海鲜', '鱼鲜', '水产', '大排档'],
    '轻食': ['轻食', '沙拉', '健康餐', '素食', '简餐'],
    '面馆': ['面馆', '拉面', '米粉', '面食', '牛肉面'],
    '快餐': ['快餐', '便当', '汉堡', '炸鸡', '简餐'],
    '冒菜': ['冒菜', '麻辣烫', '串串'],
    '麻辣烫': ['麻辣烫', '冒菜', '串串'],
    '串串': ['串串', '麻辣烫', '冒菜', '火锅'],
    '烧鸟': ['烧鸟', '居酒屋', '日式烧烤', '日料'],
    '自助餐': ['自助', '自助餐', '海鲜自助', '烤肉自助'],
    '饺子': ['饺子', '水饺', '蒸饺', '锅贴', '小笼包'],
    '包子': ['包子', '小笼包', '汤包', '锅贴', '饺子'],
    '咖啡': ['咖啡', '咖啡厅', '咖啡馆', '下午茶'],
    '奶茶': ['奶茶', '饮品', '甜品', '下午茶'],
    '甜品': ['甜品', '蛋糕', '面包', '点心', '下午茶'],
    '北京菜': ['北京菜', '京菜', '烤鸭', '涮羊肉', '京味'],
    '西北菜': ['西北菜', '陕西菜', '兰州', '牛肉面', '羊肉泡馍'],
    '云南菜': ['云南菜', '滇菜', '过桥米线', '汽锅鸡'],
    '贵州菜': ['贵州菜', '黔菜', '酸汤鱼'],
    '鲁菜': ['鲁菜', '山东菜', '孔府菜'],
    '江西菜': ['江西菜', '赣菜'],
    '福建菜': ['福建菜', '闽菜', '沙茶面'],
    '广西菜': ['广西菜', '桂菜', '螺蛳粉', '桂林米粉'],
    '西餐': ['西餐', '牛排', '意大利菜', '法式', '西式'],
    '意大利菜': ['意大利菜', '意面', '披萨', '西餐'],
  };

  if (expansionMap[cuisine]) {
    return expansionMap[cuisine].join('|');
  }
  return cuisine;
}

// 导出共享常量供其他服务使用
export { CUISINE_KEYWORDS_FOR_FILTER, CUISINE_SEMANTIC_MAP };

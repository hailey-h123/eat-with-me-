/**
 * 评分服务
 * 包含: 权重配置、菜系匹配、口味元素融合、忌口过滤、单人/群体评分、多样性平衡
 */
import { parseIntent } from './llmService';
import { haversineDistance } from './amapService';
import {
  CUISINE_KEYWORDS_FOR_FILTER,
  CUISINE_SEMANTIC_MAP,
} from '../data/cuisineMap';

// 中文字典（直接内联，不再使用 i18n）
const ZH_DICT = {
  'reason.cravePerfect': '{name}：想吃{cuisines}，完美契合',
  'reason.cravePartial': '{name}：想吃{cuisines}，部分契合',
  'reason.craveMismatch': '{name}：想吃{cuisines}，菜系不匹配',
  'reason.craveMatchSolo': '想吃{cuisines}',
  'reason.cravePartialSolo': '想吃{cuisines}',
  'reason.craveMismatchSolo': '想吃{cuisines}，菜系不匹配',
  'reason.noPrefs': '{name}：无特殊偏好，餐厅适合',
  'reason.allergy': '{name}：含{allergy}相关，扣分',
  'reason.allergyVegPartial': '{name}：有素菜可选，扣分较少',
  'reason.allergyVegMismatch': '{name}：以肉食为主，扣分',
  'reason.allergyPass': '{name}：避开{allergies}，餐厅适合',
  'reason.budgetOk': '{name}：预算内',
  'reason.budgetSlightlyOver': '{name}：略超预算',
  'reason.budgetOver': '{name}：超预算',
  'reason.budgetRange': '人均{price}元 — 在预算范围内',
  'reason.budgetRangeOver': '人均{price}元 — 超出预算范围',
  'reason.distanceNear': '{name}：步行{mins}分钟 — 很近',
  'reason.distanceModerate': '{name}：步行{mins}分钟 — 距离适中',
  'reason.distanceFar': '{name}：步行{mins}分钟 — 稍远',
  'reason.reviewsMany': '{count}+评价 — 口碑验证',
  'reason.reviewsSome': '{count}+评价 — 有一定人气',
  'reason.groupAllSatisfied': '全员满意！',
  'reason.groupSatisfied': '满足 {satisfied}/{total} 位成员',
  'reason.groupNoneSatisfied': '未能满足所有人偏好',
  'reason.groupUnmatched': '{count}位未匹配',
  'reason.groupVerySatisfied': '（{n}位非常满意）',
  'reason.groupSpread': '成员满意度差异大（{low} vs {high}）',
  'reason.groupUnhappy': '{count}位成员不太满意',
  'reason.fusionPerfect': '完美融合！同时满足两人的口味偏好',
  'reason.fusionFlavor': '口味融合 — 共享相似的风味元素',
  'reason.fusionStyle': '形式融合 — 做法上有共通之处',
  'reason.fusionPerfectCuisine': '{a}×{b}的完美融合',
  'reason.fusionFlavorShared': '主打{el}风味，可满足{a}或{b}的口味期待',
  'reason.fusionFlavorGeneric': '口味上有共通之处，可融合',
  'reason.fusionStyleShared': '做法上有共通之处，可融合',
  'reason.fusionElemFlavor': '带有{el}风味，满足{cuisine}的口味期待',
  'reason.fusionElemStyle': '采用{el}做法，与{cuisine}形式相近',
  'reason.fusionElemPerfect': '主打{el}，完美契合{cuisine}需求',
  'reason.fusionNearFlavor': '风味接近{cuisine}',
  'reason.fusionNearSpicy': '风味接近{cuisine}的辣系',
  'reason.fusionMethod': '做法与{cuisine}相近',
  'reason.fusionFits': '契合{cuisine}需求',
  'reason.conflictResolved': '{resolution}',
  'reason.conflictAllResolved': '完美解决所有冲突！',
  'reason.budgetSlightlyOverRange': '人均{price}元 — 略超预算',
  'reason.budgetOverRange': '人均{price}元 — 超出预算较多',
  'reason.priceMissing': '价格信息缺失',
  'reason.distanceNearSolo': '步行{mins}分钟 — 很近',
  'reason.distanceModerateSolo': '步行{mins}分钟 — 距离适中',
  'reason.distanceFarSolo': '步行{mins}分钟 — 稍远',
};

function t(key, params) {
  let text = ZH_DICT[key] || key;
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      const val = String(v ?? '');
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), val);
    });
  }
  return text;
}

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
  '火锅': { temperature: ['热汤', '涮'], style: ['涮锅', '涮肉', '焖煮'], social: ['适合聚餐'] },
  '冒菜': { temperature: ['热汤'], style: ['烫煮', '焖煮'], spicy: ['麻辣', '香辣'] },
  '麻辣烫': { temperature: ['热汤'], style: ['烫煮'], spicy: ['麻辣'] },
  '串串': { temperature: ['热汤'], style: ['涮锅'], spicy: ['麻辣', '香辣'] },
  '烤肉': { temperature: ['烤制'], style: ['烤制', '炙烤'], social: ['适合聚餐'] },
  '烧烤': { temperature: ['烤制'], style: ['烤制', '炙烤'], taste: ['香', '酥脆'] },
  '日料': { taste: ['鲜', '清淡'], style: ['蒸', '拌'], temperature: ['凉拌'] },
  '烧鸟': { temperature: ['烤制'], style: ['烤制', '炙烤'], taste: ['香'] },
  '韩餐': { spicy: ['微辣'], style: ['烤制', '炒'], taste: ['鲜'] },
  '江浙菜': { taste: ['鲜', '甜', '清淡'], style: ['蒸', '炒', '炖'] },
  '粤菜': { taste: ['鲜', '清淡'], style: ['蒸', '炒', '炖'] },
  '东北菜': { taste: ['浓郁', '香'], style: ['炒', '炖', '烤制'], social: ['适合聚餐'] },
  '新疆菜': { taste: ['香', '浓郁'], style: ['烤制', '炒'], temperature: ['烤制'] },
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
 * 菜系同义词扩展：用于 directMatch 时把子类/具体形式也视为偏好命中
 * 例：偏好"烧烤"时，烤串/羊肉串/撸串/烤鱼 等子类也应算 directMatch
 */
export const CUISINE_SYNONYMS = {
  '烧烤': ['烧烤', '烤串', '羊肉串', '撸串', '烤鱼', '烤生蚝', '串烤', '烤肉'],
  '烤肉': ['烤肉', '韩式烤肉', '日式烤肉', '烧肉', '炙烤'],
  '火锅': ['火锅', '涮锅', '涮肉', '铜锅', '鸳鸯锅', '打边炉', '锅物', '寿喜烧', '寿喜锅', '涮涮锅', '涮羊肉', '羊肉火锅', '牛肉火锅', '粥底火锅', '椰子鸡', '豆捞', '泰式火锅', '日式火锅', '小火锅', '转转火锅', '烤涮', '烤涮一体'],
  '串串': ['串串', '串串香', '冷锅串串'],
  '冒菜': ['冒菜', '麻辣烫'],
  '麻辣烫': ['麻辣烫', '冒菜'],
  '川菜': ['川菜', '四川菜', '重庆菜', '川渝', '川味', '蜀菜'],
  '湘菜': ['湘菜', '湖南菜'],
  '粤菜': ['粤菜', '广东菜', '广式', '潮汕菜'],
  '江浙菜': ['江浙菜', '江南菜', '本帮菜', '杭帮菜', '上海菜', '淮扬菜', '宁波菜', '无锡菜'],
  '日料': ['日料', '日本料理', '日式', '寿司', '刺身', '居酒屋'],
  '韩餐': ['韩餐', '韩国料理', '韩式', '韩国菜'],
  '西餐': ['西餐', '西式', '牛排', '意大利菜', '法式', '意式', '美式'],
};

/**
 * 检查餐厅特征是否命中某偏好的同义词（用于 directMatch / 完美契合判定）
 */
// 反向匹配黑名单：食材/口味通用词不应通过 syn.includes(f) 误匹配菜系同义词
// 例如 '烤肉'.includes('牛肉')=true（牛肉是食材不是菜系），'涮羊肉'.includes('羊肉')=true
const GENERIC_INGREDIENTS = new Set([
  // 肉类
  '牛肉','羊肉','猪肉','鸡肉','鸭肉','鱼肉','肥牛','肥羊','五花肉',
  // 海鲜
  '生蚝','虾','蟹','贝','鳗鱼','青口贝','扇贝','鱿鱼','海鲜',
  // 主食
  '粥','粉','面','饭','馒头','饺子','面条','米粉',
  // 蔬菜/豆制品
  '豆腐','豆皮','菌菇','蔬菜','毛肚','鸭血','鸭肠','黄喉','牛蛙',
  // 通用口味/标签
  '麻辣','香辣','酸辣','微辣','单人餐','双人餐','自助餐',
]);

export function featuresMatchPreference(features, pref) {
  const synonyms = CUISINE_SYNONYMS[pref] || [pref];
  return features.some(f => {
    if (!f) return false;
    for (const syn of synonyms) {
      if (syn === f) return true;
      if (f.includes(syn) && (f.length - syn.length) <= 4) return true;
      if (syn.includes(f) && f.length >= 2 && !GENERIC_INGREDIENTS.has(f)) return true;
    }
    return false;
  });
}

/**
 * 检查两个偏好是否能融合
 * @returns {{ canFusion: boolean, fusionType: string, fusionReason: string }}
 */
function checkFusion(pref1, pref2, restaurantFeatures, cuisine = '', flavorFeatures = null) {
  // flavorFeatures 用于 flavor 融合（口味元素如麻辣），默认等于 restaurantFeatures
  const flavorFeat = flavorFeatures || restaurantFeatures;
  // 0. 互斥检查：火锅系 vs 烧烤系属于做法差异，不通过 directMatch 判定完美契合
  //    （避免"串串火锅"被误判为契合"烧烤"）
  const HOTPOT_SYNS = CUISINE_SYNONYMS['火锅'] || [];
  const GRILL_SYNS = [...(CUISINE_SYNONYMS['烧烤'] || []), ...(CUISINE_SYNONYMS['烤肉'] || [])];
  const pref1IsHotpot = HOTPOT_SYNS.includes(pref1) || pref1 === '火锅';
  const pref2IsHotpot = HOTPOT_SYNS.includes(pref2) || pref2 === '火锅';
  const pref1IsGrill = GRILL_SYNS.includes(pref1) || ['烧烤', '烤肉'].includes(pref1);
  const pref2IsGrill = GRILL_SYNS.includes(pref2) || ['烧烤', '烤肉'].includes(pref2);
  const isHotpotVsGrill = (pref1IsHotpot && pref2IsGrill) || (pref1IsGrill && pref2IsHotpot);

  // 1. 直接匹配检查（使用同义词扩展：烤串/羊肉串等子类也算命中"烧烤"）
  //    但火锅 vs 烧烤 不走 perfect，避免串串/冒菜被误判为契合烧烤
  //    directMatch 用 flavorFeat（含 tags），因为"餐厅是否体现川菜"需要看分类标签
  const directMatch1 = featuresMatchPreference(flavorFeat, pref1);
  const directMatch2 = featuresMatchPreference(flavorFeat, pref2);

  if (directMatch1 && directMatch2 && !isHotpotVsGrill) {
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
    // style 融合主导菜系检查：餐厅主导菜系(cuisine)必须同时体现双方偏好才算形式融合
    // 避免烤肉店因 features 里有少量"涮锅"菜品就被判为"与火锅形式融合"
    if (fusionType === 'style' && cuisine) {
      const cHit1 = featuresMatchPreference([cuisine], pref1);
      const cHit2 = featuresMatchPreference([cuisine], pref2);
      // cuisine 明确只属于一方偏好 → 不是形式融合，跳过 FUSION_MATRIX 的 style 判定
      if ((cHit1 && !cHit2) || (!cHit1 && cHit2)) {
        // 火锅×烧烤：cuisine 只标了一方（如"烧烤"），但 tags 可能同时有"火锅"+"烧烤"
        // 不 early return，继续走后续兜底逻辑（用 flavorFeat 含 tags）判定真·烤涮一体
        if (!isHotpotVsGrill) {
          // 其他 style 融合：保持原逻辑，cuisine 只属于一方 → 不是形式融合
          const flavorFusion = checkFlavorFusion(pref1, pref2, restaurantFeatures, cuisine);
          if (flavorFusion) return flavorFusion;
          return { canFusion: false, fusionType: 'none', fusionReason: '', member1Reason: '', member2Reason: '', member1Matched: [], member2Matched: [] };
        }
      }
    }

    const profile1 = CUISINE_FLAVOR_PROFILE[pref1] || {};
    const profile2 = CUISINE_FLAVOR_PROFILE[pref2] || {};

    // flavor 融合用 flavorFeat（含菜品口味标签），style 融合用 restaurantFeatures（仅主营业务）
    const featsForType = fusionType === 'flavor' ? flavorFeat : restaurantFeatures;
    let fusionDetail = checkFusionElements(featsForType, profile1, profile2, fusionType);

    // 元素级匹配失败时，按融合类型选择兜底元素
    if (!fusionDetail.canFusion) {
      // 类别级匹配：检查餐厅特征是否与偏好菜系直接相关（使用同义词扩展）
      const hasPref1 = featuresMatchPreference(featsForType, pref1);
      const hasPref2 = featuresMatchPreference(featsForType, pref2);
      // 必须两边偏好都在餐厅特征中有直接体现，才算融合
      if (hasPref1 && hasPref2) {
        const p1 = CUISINE_FLAVOR_PROFILE[pref1] || {};
        const p2 = CUISINE_FLAVOR_PROFILE[pref2] || {};
        // 兜底元素：每个成员只用自己的 profile 元素，不混入对方的（防止烤肉店拿到火锅涮烫）
        let fallback1, fallback2;
        if (fusionType === 'flavor') {
          fallback1 = [...(p1.spicy || []), ...(p1.taste || [])];
          fallback2 = [...(p2.spicy || []), ...(p2.taste || [])];
        } else if (fusionType === 'style') {
          fallback1 = [...(p1.style || []), ...(p1.temperature || []).filter(tt => ['热汤', '涮'].includes(tt))];
          fallback2 = [...(p2.style || []), ...(p2.temperature || []).filter(tt => ['热汤', '涮'].includes(tt))];
        } else {
          fallback1 = [...(p1.spicy || []), ...(p1.taste || []), ...(p1.style || [])];
          fallback2 = [...(p2.spicy || []), ...(p2.taste || []), ...(p2.style || [])];
        }
        fusionDetail = {
          canFusion: true,
          matched1: fallback1,
          matched2: fallback2,
        };
      }

      // 第3层兜底：火锅vs烧烤的 style 融合，用完整特征集再查一次
      // 烤涮一体餐厅的烧烤信号在 featureTags 中（如 business.tag="烧烤"），不在 cuisine/name 中
      // fullHas1 && fullHas2 双重验证已足够——新疆菜等不会有BOTH火锅AND烧烤信号
      if (!fusionDetail.canFusion && fusionType === 'style' && isHotpotVsGrill) {
        const fullHas1 = featuresMatchPreference(flavorFeat, pref1);
        const fullHas2 = featuresMatchPreference(flavorFeat, pref2);
        if (fullHas1 && fullHas2) {
          const m1 = [...new Set(flavorFeat.filter(f => featuresMatchPreference([f], pref1)))].slice(0, 3);
          const m2 = [...new Set(flavorFeat.filter(f => featuresMatchPreference([f], pref2)))].slice(0, 3);
          fusionDetail = { canFusion: true, matched1: m1, matched2: m2 };
        }
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

  // 3. 通过口味特征融合（用 flavorFeat，含菜品口味标签）
  const allFlavorFeatures = [...new Set([...flavorFeat])];
  const flavorFusion = checkFlavorFusion(pref1, pref2, allFlavorFeatures, cuisine);
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

    // Dev 断言日志：两个菜系属于不同大类但 crossAllowed 未配置融合关系
    // 提示新增菜系组合时容易遗漏，需在 crossAllowed 中显式添加
    if (import.meta.env && import.meta.env.DEV) {
      console.warn(
        `[areInSameCategory] 跨大类组合未配置融合关系：${pref1}(${pref1Category}) × ${pref2}(${pref2Category}) → 视为不可融合。` +
        `若此组合实际可融合，请在 crossAllowed 中添加 [${pref1Category}, ${pref2Category}] 映射。`
      );
    }
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
function checkFlavorFusion(pref1, pref2, allFeatures, cuisine = '') {
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
  const pref1NeedsRoast = (pref1Profile.style || []).some(s => ['烤制', '炙烤', '烤'].includes(s));
  const pref2NeedsRoast = (pref2Profile.style || []).some(s => ['烤制', '炙烤', '烤'].includes(s));

  // 主导菜系守卫：如果 cuisine 明确属于某一方，禁止跨菜系融合
  // 例如：串串店(cuisine="串串")属于火锅系，不应与烧烤产生融合
  let cuisineBlocksHot = false;   // cuisine 明确属于烧烤系，禁止热汤融合
  let cuisineBlocksRoast = false; // cuisine 明确属于火锅系，禁止烤制融合
  if (cuisine) {
    const HOTPOT_SYNS = CUISINE_SYNONYMS['火锅'] || [];
    const GRILL_SYNS = [...(CUISINE_SYNONYMS['烧烤'] || []), ...(CUISINE_SYNONYMS['烤肉'] || [])];
    const cuisineIsHotpot = HOTPOT_SYNS.includes(cuisine);
    const cuisineIsGrill = GRILL_SYNS.includes(cuisine);
    // cuisine 只属于火锅系 → 禁止烤制融合
    if (cuisineIsHotpot && !cuisineIsGrill) cuisineBlocksRoast = true;
    // cuisine 只属于烧烤系 → 禁止热汤融合
    if (cuisineIsGrill && !cuisineIsHotpot) cuisineBlocksHot = true;
  }
  
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
    const hasRoast = (profile?.style || []).some(s => ['烤制', '炙烤', '烤'].includes(s));
    
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
  
  // 形式融合：餐厅必须同时具备火锅和烧烤的关键词（真正的烤涮一体/火锅烧烤店）
  // 纯烤肉店只有烧烤关键词没有火锅关键词 → 不触发
  // 纯火锅店只有火锅关键词没有烧烤关键词 → 不触发
  if (hasHot && hasRoast && !cuisineBlocksHot && !cuisineBlocksRoast) {
    // 每个成员拿到自己需要的匹配元素：火锅成员拿热汤元素，烧烤成员拿烤制元素
    const member1Matched = [
      ...(pref1NeedsHot ? matchedHot : []),
      ...(pref1NeedsRoast ? matchedRoast : []),
    ];
    const member2Matched = [
      ...(pref2NeedsHot ? matchedHot : []),
      ...(pref2NeedsRoast ? matchedRoast : []),
    ];
    const member1Reason = getMemberReason(pref1, member1Matched, pref1Profile, 'style');
    const member2Reason = getMemberReason(pref2, member2Matched, pref2Profile, 'style');
    const hotDesc = matchedHot.slice(0, 2).join('、');
    const roastDesc = matchedRoast.slice(0, 2).join('、');
    return {
      canFusion: true,
      fusionType: 'style',
      fusionReason: `同时具备${hotDesc}与${roastDesc}做法，形式融合`,
      member1Reason,
      member2Reason,
      member1Matched,
      member2Matched,
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
    // 优先用餐厅实际特征词做证据（涮肉、火锅店等），而非 profile 抽象元素
    const actualFeatures = matched.filter(m =>
      m !== pref && !['热汤', '涮', '烤制', '炙烤', '烤'].includes(m)
    );
    const actualDesc = actualFeatures.length > 0
      ? actualFeatures.slice(0, 2).join('、')
      : '';

    // profile 元素匹配作为 fallback
    const profileElements = [
      ...(profile?.spicy || []), ...(profile?.taste || []),
      ...(profile?.style || []), ...(profile?.temperature || []),
    ];
    const relevant = matched.filter(m => profileElements.includes(m));
    const elementDesc = getElementDesc(relevant);
    const hasSpicy = (profile?.spicy || []).length > 0;
    const hasHot = (profile?.temperature || []).some(t => ['热汤', '火锅', '涮'].includes(t));
    const hasRoast = (profile?.style || []).some(s => ['烤制', '炙烤', '烤'].includes(s));

    if (fusionType === 'perfect') {
      if (actualDesc) return `这家店有${actualDesc}，完美契合${pref}`;
      if (elementDesc) return `主打${elementDesc}，完美契合${pref}需求`;
      return `完美契合${pref}`;
    }

    if (fusionType === 'flavor') {
      if (actualDesc) return `这家店有${actualDesc}，符合${pref}口味`;
      if (hasSpicy && elementDesc) return `带有${elementDesc}风味，满足${pref}的口味期待`;
      if (hasSpicy) return `风味接近${pref}的辣系`;
      return `风味接近${pref}`;
    }

    if (fusionType === 'style') {
      if (actualDesc) return `这家店有${actualDesc}，与${pref}做法一致`;
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

// 菜系关键词 & 语义映射已迁移到 src/data/cuisineMap.js（统一管理，避免与 llmService 不同步）

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

export function checkPrefMatch(pref, restaurantFeatures) {
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
  const min = 25, max = 120;
  const targetMin = 50, targetMax = 99;
  const clamped = Math.max(min, Math.min(max, safeRaw));
  const ratio = (clamped - min) / (max - min);
  const safeRatio = typeof ratio === 'number' && !isNaN(ratio) && isFinite(ratio) ? ratio : 0.5;
  const stretchedRatio = Math.pow(safeRatio, 0.65);
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

// 硬约束忌口：一票否决（健康/宗教/过敏，完全不能碰）
const HARD_ALLERGIES = ['清真', '海鲜', '坚果', '花生', '牛奶', '乳糖不耐'];

// 联合过敏：当一个成员有此偏好，另一个成员有此过敏时，触发冲突
// 冲突本身不否决餐厅，而是通过评分和化解机制来处理
const CONFLICT_PAIRS = [
  { preference: '火锅', allergy: '辣' },
  { preference: '川菜', allergy: '辣' },
  { preference: '湘菜', allergy: '辣' },
  { preference: '贵州菜', allergy: '辣' },
  { preference: '江西菜', allergy: '辣' },
  { preference: '烧烤', allergy: '素食' },
  { preference: '烤肉', allergy: '素食' },
  { preference: '火锅', allergy: '素食' },
];

// 软约束：不否决，但降分
const SOFT_ALLERGIES = ['辣', '麻辣', '香菜', '减肥', '低卡', '素食'];

// 强力软约束：不否决，但大幅降分（如素食，肉餐厅也有素菜可选）
const STRONG_SOFT_ALLERGIES = ['素食'];

const ALLERGY_PENALTY = {
  '辣': 15,
  '麻辣': 15,
  '香菜': 12,
  '素食': 25,
  '减肥': 10,
  '低卡': 10,
};

// 冲突化解加分已改为信号数分级制（0信号+2 / 1-2信号+6 / 3+信号+10）

const ALLERGY_TRAIT_MAP = {
  '辣': 'spicy',
  '麻辣': 'spicy',
  '香菜': 'cilantro',
  '减肥': 'heavy',
  '低卡': 'heavy',
};

const RESTAURANT_TRAIT_MAP = {
  'spicy': ['辣', '麻辣', '川菜', '四川菜', '川味', '湘菜', '湖南菜', '湘味', '重庆', '串串', '冒菜', '麻辣烫', '剁椒', '水煮', '红油', '泡椒', '香辣', '冬阴功', '麻辣香锅'],
  'seafood': ['海鲜', '水产', '渔港', '鱼港', '寿司', '刺身', '海鲜自助', '海鲜酒楼', '大排档', '日式料理', '日本料理'],
  'meat': ['烤肉', '烧烤', '烤串', '撸串', '牛排', '汉堡', '炸鸡', '韩式烤肉', '日式烤肉', '烧肉', '德国咸猪手', '炭烤', '美式烧烤'],
  'heavy': ['烤肉', '烧烤', '自助', '汉堡', '炸鸡', '甜品', '蛋糕', '披萨'],
  'vegetarian_friendly': ['素食', '素菜', '沙拉', '轻食', '健康餐', '菌菇', '豆制品', '蔬菜', '素食馆', '素菜馆', '素斋', '纯素', '全素', '素食自助'],
  'fast': ['快餐', '面馆', '米线', '拉面', '小吃', '便当', '定食'],
  'slow': ['火锅', '烤肉', '西餐', '日料', '自助餐'],
  'hot': ['砂锅', '麻辣烫', '冒菜', '串串', '热汤', '炖菜', '煲仔', '锅物', '热锅', '火锅'],
  'cold': ['沙拉', '轻食', '冷面', '冰淇淋', '甜品', '刺身', '寿司', '凉面', '冰沙'],
};

function restaurantHasTrait(restaurant, trait) {
  const keywords = RESTAURANT_TRAIT_MAP[trait] || [];
  const allText = [...(restaurant.tags || []), ...(restaurant.features || []), restaurant.cuisine || '', restaurant.name || ''].join('');
  return keywords.some(kw => allText.includes(kw));
}

// ============ 冲突化解安全信号提取 ============

// 安全信号分层白名单
// - strong：直接证明冲突可化解（辣度标注、锅底类型、做法证据）
// - weak：间接推断（口味偏淡、改良/新派、场景信号）
// 两类都展示，strong 排前面
const SAFE_SIGNAL_DISPLAY = {
  '辣': {
    strong: [
      '不辣', '微辣', '去辣', '免辣', '无辣', '少辣',
      '清汤', '鸳鸯', '菌汤', '番茄', '骨汤', '养生', '药膳',
      '三鲜', '寿喜', '豆乳', '味噌', '椰子', '猪肚', '花胶', '花雕', '粥底',
    ],
    weak: [
      '白灼', '清蒸', '蒜蓉蒸', '豉汁蒸', '盐焗', '白切', '白斩', '盐水', '卤水',
      '清淡', '原味', '鲜甜', '蒜蓉', '葱油', '酱香',
      '豉汁', '豉油', '蚝油', '上汤', '姜葱', '茄汁',
      '椰香', '咸鲜', '酸甜', '糖醋', '黑椒', '咖喱',
      '改良', '新派', '融合', '创意', '新式',
      '宝宝', '儿童', '清淡餐', '滋补', '养胃',
    ],
  },
  '素食': {
    strong: [
      '素菜', '素食', '蔬菜', '时蔬', '野菜', '菌菇',
      '豆腐', '豆皮', '腐竹', '豆制品', '面筋', '魔芋',
      '沙拉', '轻食',
    ],
    weak: [
      '凉拌', '白灼', '清炒', '蒜蓉', '上汤', '清蒸',
    ],
  },
  '海鲜': {
    strong: [
      '烧腊', '叉烧', '烤肉', '卤', '烤鸭', '白切',
    ],
    weak: [
      '拉面', '炒饭', '炒面', '肠粉', '粥',
      '煎饺', '锅贴', '包子', '小笼', '炸猪排', '炸鸡',
      '红烧', '糖醋', '咖喱', '照烧', '铁板', '焗',
      '沙拉', '甜品', '饮品',
    ],
  },
  '减肥': {
    strong: [
      '轻食', '沙拉', '低卡', '减脂', '素食', '清蒸', '白灼', '清汤',
    ],
    weak: [
      '凉拌', '蔬菜', '鸡胸', '豆腐', '菌菇', '海鲜', '刺身',
      '低脂', '清淡', '健康', '养生', '药膳', '原味', '清炒',
    ],
  },
};

// 饮品/甜点过滤器：这些标签跟冲突化解无关，即使命中了白名单也不展示不计分
function isDrinkOrDessert(tag) {
  const DRINK_SUFFIX = ['茶', '饮', '汁', '酒', '啤', '奶', '咖', '啡', '冰'];
  const DESSERT_KEYS = ['蛋糕', '冰淇淋', '冰激凌', '甜品', '慕斯', '布丁', '奶盖', '雪糕', '蛋挞', '点心', '早茶', '茶点'];
  if (DRINK_SUFFIX.some(s => tag.endsWith(s))) return true;
  if (DESSERT_KEYS.some(s => tag.includes(s))) return true;
  if ((tag.endsWith('水') || tag === '水') && tag.length <= 3) return true;
  return false;
}

// 从餐厅已有标签中提取安全信号（分层白名单 + 饮品过滤）
function extractSafeTags(restaurant, allergy) {
  const signals = SAFE_SIGNAL_DISPLAY[allergy];
  if (!signals) return [];

  const allTags = [
    ...(restaurant.featureTags || []),
    ...(restaurant.features || []),
    ...(restaurant.tags || []),
  ];
  const uniqueTags = [...new Set(allTags.filter(t => t && typeof t === 'string' && t.length >= 2))];

  const strongSet = new Set(signals.strong);

  return uniqueTags.filter(tag =>
    strongSet.has(tag) || signals.weak.some(s => tag.includes(s))
  ).filter(tag => !isDrinkOrDessert(tag))
  .sort((a, b) => {
    const aStrong = strongSet.has(a) ? 0 : 1;
    const bStrong = strongSet.has(b) ? 0 : 1;
    return aStrong - bStrong;
  }).slice(0, 5);
}

// 获取安全信号命中数（用于评分体系）
// 返回命中的信号数，调用方可据此微调冲突化解的置信度
export function countSafeSignals(restaurant, allergy) {
  return extractSafeTags(restaurant, allergy).length;
}

// 把安全标签格式化为文案片段，如 "【酸菜鱼】【改良】【清汤】"
function formatSafeTagsForText(safeTags) {
  if (!safeTags || safeTags.length === 0) return '';
  return safeTags.slice(0, 3).map(t => `【${t}】`).join('');
}

// 标签不足时的菜系兜底提示：根据餐厅分类给一句有理有据的解释
// 不碰标签、不猜菜名，只看 cuisine / tags 中的分类词做判断
// 从餐厅标签/菜系中提取人类可读的菜系名（用于冲突化解文本）
function inferCuisineName(restaurant) {
  const text = [restaurant.cuisine || '', ...(restaurant.tags || []), ...(restaurant.features || [])].join('');
  const CUISINE_NAMES = [
    '云南菜', '贵州菜', '江西菜', '湘菜', '川菜', '粤菜', '江浙菜',
    '东北菜', '北京菜', '鲁菜', '西北菜', '新疆菜', '福建菜', '广西菜',
    '东南亚菜', '韩餐', '日料', '西餐', '火锅', '麻辣烫', '串串', '冒菜',
  ];
  for (const name of CUISINE_NAMES) {
    if (text.includes(name)) return name;
  }
  return restaurant.cuisine || '该餐厅';
}

function getFallbackTip(restaurant, allergy) {
  const allText = [...(restaurant.tags || []), ...(restaurant.features || []), restaurant.cuisine || '', restaurant.name || ''].join('');
  const is = (keywords) => keywords.some(k => allText.includes(k));

  switch (allergy) {
    case '辣': {
      if (is(['火锅', '涮锅', '涮肉', '铜锅', '打边炉', '锅物']))
        return '可点清汤/番茄/菌汤/猪肚等非辣锅底';
      if (is(['麻辣烫', '串串', '冒菜']))
        return '可自选不辣或少辣汤底';
      if (is(['川菜', '四川', '重庆']))
        return '一般有粉蒸肉/咸烧白/甜烧白等经典不辣川菜';
      if (is(['湘菜', '湘', '湖南']))
        return '一般有腊味合蒸/粉蒸排骨等经典不辣湘菜';
      if (is(['日料', '日式', '日本料理', '居酒屋', '寿司']))
        return '刺身/寿司/拉面/定食等多数天然不辣';
      if (is(['粤菜', '广式', '广东', '茶餐厅']))
        return '白切鸡/蒸点/肠粉/煲仔饭等天然不辣';
      if (is(['江浙菜', '本帮', '杭帮', '淮扬', '上海菜']))
        return '多数菜品偏清淡天然不辣';
      if (is(['西餐', '牛排', '意大利菜', '法式', '美式']))
        return '多数菜品天然不辣或可调辣度';
      if (is(['韩餐', '韩国料理', '韩式']))
        return '可选石锅拌饭/冷面/紫菜包饭等不辣韩餐';
      if (is(['东南亚', '泰国', '越南', '新加坡']))
        return '可选越南河粉/海南鸡饭等不辣东南亚菜';
      if (is(['云南菜', '滇菜', '云南']))
        return '有过桥米线/汽锅鸡等经典不辣云南菜';
      if (is(['新疆菜', '新疆']))
        return '大盘鸡/手抓饭等一般不辣或微辣';
      if (is(['东北菜', '东北']))
        return '锅包肉/地三鲜/小鸡炖蘑菇等天然不辣';
      if (is(['北京菜', '京菜', '北京']))
        return '烤鸭/京酱肉丝/炸酱面等天然不辣';
      if (is(['鲁菜', '山东']))
        return '九转大肠/葱烧蹄筋/黄焖鸡等天然不辣';
      if (is(['西北菜', '西北', '陕西', '西安', '兰州']))
        return '羊肉泡馍/肉夹馍等天然不辣';
      if (is(['江西菜', '赣菜', '江西']))
        return '有南昌炒粉/瓦罐汤/藜蒿炒腊肉等经典不辣江西菜';
      if (is(['福建菜', '闽菜', '福建']))
        return '闽菜偏清淡，多数天然不辣';
      if (is(['广西菜', '桂菜', '广西']))
        return '螺蛳粉/桂林米粉等可调辣度或不辣版';
      if (is(['面馆', '饺子', '包子', '小笼', '锅贴']))
        return '面食/饺子/包子天然不辣';
      if (is(['粥', '汤', '稀饭', '炖汤']))
        return '粥品/炖汤天然不辣';
      if (is(['轻食', '沙拉', '健康']))
        return '轻食沙拉天然不辣';
      return '可询问店家调整辣度或选择不辣菜品';
    }

    case '素食': {
      if (is(['火锅', '涮锅', '涮肉', '铜锅']))
        return '可涮菌菇/蔬菜/豆腐/豆皮/玉米等素食';
      if (is(['烤肉', '烧烤', '烤串']))
        return '有蔬菜拼盘/菌菇/玉米/茄子可烤';
      if (is(['川菜', '四川', '重庆']))
        return '可点麻婆豆腐（去肉末）/开水白菜/素菜煲等素食川菜';
      if (is(['湘菜', '湘', '湖南']))
        return '可点剁椒蒸芋头/蒸蛋羹/炒时蔬等素食湘菜';
      if (is(['粤菜', '广式', '广东', '茶餐厅']))
        return '可点白灼时蔬/罗汉斋/素肠粉等素食粤菜';
      if (is(['江浙菜', '本帮', '杭帮', '淮扬']))
        return '可点清炒时蔬/素烧鹅/桂花糖藕等素食江浙菜';
      if (is(['日料', '日式', '日本料理', '居酒屋']))
        return '可点豆腐/毛豆/蔬菜天妇罗/沙拉等素食日料';
      if (is(['韩餐', '韩国料理', '韩式']))
        return '可点石锅拌饭（去肉）/泡菜豆腐汤等素食韩餐';
      if (is(['西餐', '意大利菜', '法式', '美式']))
        return '可选沙拉/素意面/素披萨等素食西餐';
      if (is(['东北菜', '东北']))
        return '可点地三鲜/酸菜粉条/素炒时蔬等素食东北菜';
      if (is(['云南菜', '滇菜', '云南']))
        return '可点菌菇菜/炒时蔬/过桥米线（素版）等素食云南菜';
      if (is(['贵州菜', '黔菜', '贵州']))
        return '可点酸汤鱼（素版）/丝娃娃/炒时蔬等素食贵州菜';
      if (is(['北京菜', '京菜', '北京']))
        return '可点炸酱面（素版）/炒时蔬/芥末墩等素食北京菜';
      if (is(['鲁菜', '山东']))
        return '可点葱烧豆腐/炒时蔬等素食鲁菜';
      if (is(['新疆菜', '新疆']))
        return '可点拉条子/馕/素抓饭等素食新疆菜';
      if (is(['西北菜', '西北', '陕西', '西安', '兰州']))
        return '可点拉条子/炒时蔬/素夹馍等素食西北菜';
      if (is(['东南亚', '泰国', '越南', '新加坡']))
        return '可选越南春卷/泰式青木瓜沙拉/炒时蔬等素食东南亚菜';
      if (is(['江西菜', '赣菜', '江西']))
        return '可点南昌炒粉（素版）/瓦罐汤（素版）/炒时蔬等素食江西菜';
      return '可询问店家素食选项或让厨房特制素菜';
    }

    case '海鲜': {
      if (is(['川菜', '四川', '重庆']))
        return '可点回锅肉/鱼香肉丝/咸烧白等经典非海鲜川菜';
      if (is(['湘菜', '湘', '湖南']))
        return '可点小炒肉/剁椒蒸排骨/腊味合蒸等经典非海鲜湘菜';
      if (is(['日料', '日式', '日本料理', '居酒屋']))
        return '可点照烧鸡饭/拉面/烤物/炸猪排等非海鲜日料';
      if (is(['粤菜', '广式', '广东', '茶餐厅']))
        return '可点烧腊/白切鸡/肠粉/蒸排骨等经典非海鲜粤菜';
      if (is(['本帮菜', '上海菜']))
        return '可点红烧肉/糖醋排骨/腌笃鲜/八宝鸭等经典非海鲜本帮菜';
      if (is(['杭帮菜']))
        return '可点东坡肉/叫花鸡/笋干老鸭煲等经典非海鲜杭帮菜';
      if (is(['淮扬菜', '淮扬']))
        return '可点狮子头/大煮干丝/文思豆腐/水晶肴肉等经典非海鲜淮扬菜';
      if (is(['江浙菜', '江南', '杭州', '苏州', '南京', '宁波', '绍兴', '扬州', '无锡']))
        return '可点东坡肉/红烧肉/狮子头/炒时蔬等经典非海鲜江浙菜';
      if (is(['火锅', '涮锅', '铜锅']))
        return '可涮牛肉/羊肉/毛肚/蔬菜，避开海鲜类即可';
      if (is(['东北菜', '东北']))
        return '可点锅包肉/地三鲜/小鸡炖蘑菇等经典非海鲜东北菜';
      if (is(['北京菜', '京菜', '北京']))
        return '可点烤鸭/京酱肉丝/炸酱面等经典非海鲜北京菜';
      if (is(['鲁菜', '山东']))
        return '可点九转大肠/葱烧蹄筋/黄焖鸡等经典非海鲜鲁菜';
      if (is(['西北菜', '西北', '陕西', '西安', '兰州']))
        return '可点羊肉泡馍/大盘鸡/肉夹馍等经典非海鲜西北菜';
      if (is(['西餐', '牛排', '意大利菜', '法式', '美式']))
        return '可点牛排/意面/披萨等非海鲜西餐';
      if (is(['韩餐', '韩国料理', '韩式']))
        return '可点韩式烤肉/石锅拌饭/炸鸡等经典非海鲜韩餐';
      if (is(['东南亚', '泰国', '越南', '新加坡']))
        return '可点海南鸡饭/越南河粉（非海鲜版）/泰式炒河粉';
      if (is(['贵州菜', '黔菜', '贵州']))
        return '可点酸汤牛肉/辣子鸡等经典非海鲜贵州菜';
      if (is(['江西菜', '赣菜', '江西']))
        return '可点南昌炒粉/瓦罐汤/藜蒿炒腊肉等经典非海鲜江西菜';
      if (is(['云南菜', '滇菜', '云南']))
        return '可点汽锅鸡/宣威小炒肉/炒时蔬等经典非海鲜云南菜';
      if (is(['新疆菜', '新疆']))
        return '可点大盘鸡/手抓饭/烤包子/拉条子等经典非海鲜新疆菜';
      if (is(['福建菜', '闽菜', '福建']))
        return '可点佛跳墙（非海鲜版）/荔枝肉/炒时蔬等经典非海鲜闽菜';
      if (is(['广西菜', '桂菜', '广西']))
        return '可点螺蛳粉/桂林米粉/柠檬鸭等经典非海鲜广西菜';
      return '可避开海鲜类，选其他肉类/蔬菜菜品';
    }

    case '减肥':
    case '低卡': {
      if (is(['日料', '日式', '日本料理', '居酒屋']))
        return '可选刺身/蒸蛋/沙拉/煮物等低卡日料，避开天妇罗/炸物';
      if (is(['粤菜', '广式', '广东', '茶餐厅']))
        return '可选白灼菜/蒸鸡/煲汤/肠粉等低卡粤菜，避开蜜汁叉烧/烧鹅';
      if (is(['江浙菜', '本帮', '杭帮', '淮扬']))
        return '可选清蒸鱼/菌菇汤/凉拌菜，避开红烧/糖醋类';
      if (is(['火锅', '涮锅']))
        return '清汤锅底+蔬菜/菌菇/瘦肉，控制麻酱/香油蘸料';
      if (is(['西餐', '意大利菜', '法式', '美式']))
        return '可选沙拉/烤鸡胸/意式蔬菜汤等低卡西餐';
      if (is(['东南亚', '泰国', '越南', '新加坡']))
        return '可选越南春卷/泰式青木瓜沙拉/清蒸鱼等低卡菜';
      if (is(['云南菜', '滇菜', '云南']))
        return '可选过桥米线（少油）/汽锅鸡/菌菇菜等低卡云南菜';
      if (is(['轻食', '沙拉', '健康', '素食']))
        return '该店主打轻食/健康方向，多数菜品低卡';
      if (is(['川菜', '四川', '重庆']))
        return '可选清炒时蔬/开水白菜等低卡川菜，避开回锅肉/水煮类';
      if (is(['湘菜', '湘', '湖南']))
        return '可选蒸菜/炒时蔬等低卡湘菜，避开小炒肉/腊味类';
      if (is(['东北菜', '东北']))
        return '可选地三鲜/炒时蔬等低卡东北菜，避开锅包肉/油炸类';
      if (is(['韩餐', '韩国料理', '韩式']))
        return '可选石锅拌饭（少酱）/冷面等低卡韩餐，避开炸鸡';
      if (is(['北京菜', '京菜', '北京']))
        return '可选京酱肉丝（少酱）/炒时蔬等，避开烤鸭/炸酱面';
      if (is(['鲁菜', '山东']))
        return '可选清蒸/白灼类鲁菜，避开葱烧/红烧类';
      if (is(['西北菜', '西北', '陕西', '西安', '兰州']))
        return '可选拉条子/炒时蔬等，避开羊肉泡馍/肉夹馍';
      if (is(['贵州菜', '黔菜', '贵州']))
        return '可选酸汤鱼/炒时蔬等，避开辣子鸡/油炸类';
      if (is(['新疆菜', '新疆']))
        return '可选拉条子/馕等，避开大盘鸡/手抓饭';
      if (is(['面馆', '饺子', '包子', '粥', '汤', '米线', '粉', '便当']))
        return '面/饺/粥/汤类多数低卡可选';
      return '可选蒸/煮/白灼类菜品，避开油炸/红烧/糖醋类';
    }

    default:
      return '';
  }
}

const COMPROMISE_RULES = [
  {
    // 冲突：一人想吃 火锅/川菜/湘菜，另一人不吃辣
    // Tier 1（精确化解）：标签有不辣/微辣/清汤/鸳鸯 等明确关键词
    // Tier 2（火锅场景专门）：火锅/麻辣烫/串串 → 可分汤底
    // Tier 3（菜系特性推断折中）：川菜/湘菜无明确不辣标签，但一般有不辣菜
    match: (conflict) => conflict.allergy === '辣',
    resolve: (restaurant, conflict) => {
      const allFeatures = [...(restaurant.tags || []), ...(restaurant.features || []), restaurant.cuisine || '', restaurant.name || ''].join('');
      const featureList = [...(restaurant.tags || []), ...(restaurant.features || []), restaurant.cuisine || '', restaurant.name || ''];
      const safeTags = extractSafeTags(restaurant, '辣');
      const safeText = formatSafeTagsForText(safeTags);

      const hasSpicy = restaurantHasTrait(restaurant, 'spicy');
      // isMatch 兜底：偏好是 trait 级（如 '辣'）时 checkPrefMatch 难命中，用 hasSpicy 补
      // 扩展结果（_isExpanded）虽不匹配原始偏好菜系，但同为辣系 → 需要生成化解文案
      const isExpandedSpicy = restaurant._isExpanded && hasSpicy;
      const isMatch = !conflict?.preference
        || checkPrefMatch(conflict.preference, featureList)
        || (conflict.preference === '辣' && restaurantHasTrait(restaurant, 'spicy'))
        || isExpandedSpicy;
      if (!isMatch) return { resolved: false };
      const prefCuisine = conflict?.preference || '川菜';
      const isMildKeyword = allFeatures.includes('不辣') || allFeatures.includes('微辣') || allFeatures.includes('清汤') || allFeatures.includes('鸳鸯') || allFeatures.includes('菌汤') || allFeatures.includes('番茄') || allFeatures.includes('骨汤') || allFeatures.includes('养生') || allFeatures.includes('新派') || allFeatures.includes('改良') || allFeatures.includes('去辣') || allFeatures.includes('清淡');

      // Tier 2 优先：火锅/串串/冒菜等有场景化解能力，给出详细兜底文案
      // 避免被 Tier 1 的空 allergySide 吞掉
      const isHotpotType = allFeatures.includes('火锅') || allFeatures.includes('涮锅') || allFeatures.includes('涮肉') || allFeatures.includes('铜锅') || allFeatures.includes('打边炉') || allFeatures.includes('锅物');
      const isMalaType = allFeatures.includes('麻辣烫') || allFeatures.includes('串串') || allFeatures.includes('冒菜');
      if (isHotpotType || isMalaType) {
        return {
          resolved: true, tier: 2,
          text: safeText
            ? (isHotpotType
                ? `这家火锅店有${safeText}等非辣选项，可鸳鸯锅分汤底`
                : `这家${isMalaType ? '串串/麻辣烫' : ''}店有${safeText}等选项，可自选汤底`)
            : (isHotpotType
                ? '火锅店通常有鸳鸯锅/清汤锅/番茄锅可选，可同时满足双方'
                : '麻辣烫/串串通常可自选汤底辣度，有不辣汤底可选'),
          allergySide: safeText
            ? (isHotpotType
                ? `可选${safeText}，涮清汤锅底，不吃辣也能放心吃`
                : `可选${safeText}，跟店员明确不辣/微辣汤底即可`)
            : (isHotpotType
                ? '火锅店一般都有清汤/番茄/菌汤锅，不吃辣也能放心选'
                : '可跟店员明确要不辣/微辣汤底，菜品可单独挑不辣款'),
          prefSide: isHotpotType
            ? (conflict?.preference === '辣'
                ? '可选牛油/麻辣锅底，鸳鸯锅同时满足辣与不辣'
                : `想吃${prefCuisine}可选辣锅底，鸳鸯锅一锅两味`)
            : (isMalaType
                ? (conflict?.preference === '辣'
                    ? '可选辣汤底/麻辣汤底，自选辣度'
                    : `想吃${prefCuisine}可选辣度，自选汤底`)
                : `想吃${prefCuisine}的需求基本满足`),
          compromise: isHotpotType ? '建议选鸳鸯锅或子母锅，非单点纯辣店' : '需要分开调汤底',
        };
      }

      // Tier 1：有明确标签证据（不辣/微辣/清汤等标注，或安全信号标签）展示具体证据
      if (!hasSpicy || isMildKeyword || safeTags.length > 0) {
        return {
          resolved: true, tier: 1,
          text: safeText
            ? `这家${prefCuisine}店有${safeText}等选项，不吃辣也能放心点`
            : `这家${prefCuisine}店${!hasSpicy ? '无明显辣元素' : '有不辣/微辣选项'}，可化解冲突`,
          allergySide: safeText
            ? `店铺标注了${safeText}，不吃辣的需求已满足`
            : `不吃辣的需求已满足${isMildKeyword ? '，店铺标注了不辣/微辣/清汤等选项' : ''}`,
          prefSide: `想吃${prefCuisine}的需求已满足，同时照顾了同伴`,
          compromise: null,
        };
      }

      // Tier 3：纯菜系特性推断（川菜/湘菜没明确不辣标签）
      const isSichuanType = allFeatures.includes('川菜') || allFeatures.includes('川') || allFeatures.includes('四川') || allFeatures.includes('重庆');
      const isHunanType = allFeatures.includes('湘菜') || allFeatures.includes('湘') || allFeatures.includes('湖南');
      if (isSichuanType || isHunanType) {
        const actual = isSichuanType ? '川菜' : '湘菜';
        const fallbackDishes = isSichuanType ? '开水白菜/粉蒸肉/蒸菜' : '蒸菜/炖菜/汤菜';
        return {
          resolved: true, tier: 3,
          text: safeText
            ? `${actual}馆有${safeText}等非辣选项可点`
            : `${actual}馆可能有不辣菜品（如${fallbackDishes}等），建议到店确认`,
          allergySide: safeText
            ? `这家店有${safeText}，不吃辣也有得选`
            : `${actual}馆一般有不辣的蒸菜/炖菜/汤菜，但无法确定，建议看菜单或询问店员`,
          prefSide: `仍是纯正${actual}风味`,
          compromise: `无法确认是否有足够不辣菜品，需到店看菜单，建议同伴理解`,
        };
      }

      // Tier 4：跨菜系扩张推断（云贵菜/江西菜等辣系，来自 EXPANSION_MAP）
      // 利用 getFallbackTip 已有数据生成化解文案，不硬编码菜系名
      if (restaurant._isExpanded && hasSpicy) {
        const expandedName = inferCuisineName(restaurant);
        const fallback = getFallbackTip(restaurant, '辣');
        return {
          resolved: true, tier: 4,
          text: safeText
            ? `这家${expandedName}店有${safeText}，辣度可控`
            : (fallback ? `${expandedName}：${fallback}` : `${expandedName}辣度相比${prefCuisine}温和，可留意不辣菜品`),
          allergySide: safeText
            ? `有${safeText}可选，不吃辣也有得点`
            : (fallback || '可留意店内不辣菜品'),
          prefSide: `虽非${prefCuisine}，但${expandedName}风味相近，部分菜品辣度可选`,
          compromise: `非精确${prefCuisine}替代，辣度需自行与店家确认`,
        };
      }

      return { resolved: false };
    }
  },
  {
    // 冲突：一人想吃 烧烤/烤肉/火锅，另一人素食
    // Tier 1：标签有明确素/菌菇/豆制品/沙拉/蔬菜 关键词
    // Tier 2：火锅/烤肉 → 有素菜配菜
    // Tier 3：其他中餐厅 → 有点素菜
    match: (conflict) => conflict.allergy === '素食',
    resolve: (restaurant, conflict) => {
      const allFeatures = [...(restaurant.tags || []), ...(restaurant.features || []), restaurant.cuisine || '', restaurant.name || ''].join('');
      const prefCuisine = conflict?.preference || '偏好菜系';

      const hasVeg = allFeatures.includes('素') || allFeatures.includes('素菜') || allFeatures.includes('菌菇') || allFeatures.includes('豆制品') || allFeatures.includes('轻食') || allFeatures.includes('沙拉') || allFeatures.includes('蔬菜');
      if (hasVeg) {
        return {
          resolved: true, tier: 1,
          text: '这家店有素食选项，可满足素食需求',
          allergySide: '素食需求已满足，店铺有素菜/菌菇/豆制品标注',
          prefSide: `${prefCuisine}偏好已满足，同时照顾了素食同伴`,
          compromise: null,
        };
      }

      const isHotpot = allFeatures.includes('火锅') || allFeatures.includes('涮');
      const isBBQ = allFeatures.includes('烤肉') || allFeatures.includes('烧烤') || allFeatures.includes('烤串');
      if (isHotpot) {
        return {
          resolved: true, tier: 2,
          text: '火锅店通常有菌菇/蔬菜/豆制品可选，可满足素食需求',
          allergySide: '素毛肚/菌菇拼盘/蔬菜/豆制品基本都有，建议挑清汤锅底',
          prefSide: `${prefCuisine}偏好已满足`,
          compromise: '素食方需从配菜中挑选，无独立素食主菜',
        };
      }
      if (isBBQ) {
        return {
          resolved: true, tier: 2,
          text: '烤肉店通常有蔬菜拼盘/菌菇/玉米等素食可烤',
          allergySide: '蔬菜/菌类/玉米/茄子等一般都有，建议跟店家说素菜不要刷荤油',
          prefSide: `${prefCuisine}偏好已满足`,
          compromise: '素食种类不如专门素菜馆丰富',
        };
      }
      const isChinese = allFeatures.includes('中餐') || allFeatures.includes('中式') || allFeatures.includes('川菜') || allFeatures.includes('粤菜') || allFeatures.includes('湘菜') || allFeatures.includes('江浙菜') || allFeatures.includes('东北菜') || allFeatures.includes('北京菜') || allFeatures.includes('鲁菜') || allFeatures.includes('西北菜');
      if (isChinese) {
        return {
          resolved: true, tier: 3,
          text: '中餐厅通常有素菜可点（如炒时蔬/地三鲜等）',
          allergySide: '普通中餐厅会有炒时蔬/地三鲜/素菜煲等，点单时明确说明即可',
          prefSide: `${prefCuisine}偏好已满足`,
          compromise: '无独立素食菜单，需从普通菜单里挑选',
        };
      }

      return { resolved: false };
    }
  },
  {
    // 冲突：一人想吃日料/粤菜，另一人海鲜过敏
    // Tier 1：明确不含海鲜/鱼/虾/蟹等 → 完全安全
    // Tier 2：日料非寿司专营 / 粤菜非海鲜酒楼 → 有非海鲜选项
    // Tier 3：其他菜系非海鲜
    match: (conflict) => conflict.allergy === '海鲜',
    resolve: (restaurant, conflict) => {
      const allFeatures = [...(restaurant.tags || []), ...(restaurant.features || []), restaurant.cuisine || '', restaurant.name || ''].join('');
      const prefCuisine = conflict?.preference || '偏好菜系';

      const isSeafoodSpecialty = allFeatures.includes('海鲜') || allFeatures.includes('渔港') || allFeatures.includes('水产') || allFeatures.includes('鱼港');
      const isSushiSashimi = allFeatures.includes('寿司') || allFeatures.includes('刺身');
      if (isSeafoodSpecialty || isSushiSashimi) return { resolved: false };

      const isJapanese = allFeatures.includes('日料') || allFeatures.includes('日式') || allFeatures.includes('日本料理') || allFeatures.includes('居酒屋');
      const isCantonese = allFeatures.includes('粤菜') || allFeatures.includes('广式') || allFeatures.includes('广东') || allFeatures.includes('潮汕');
      const noSeafoodTrace = !(allFeatures.includes('鱼') || allFeatures.includes('虾') || allFeatures.includes('蟹') || allFeatures.includes('贝') || allFeatures.includes('海') || allFeatures.includes('鳗'));

      if ((isJapanese || isCantonese) && noSeafoodTrace) {
        return {
          resolved: true, tier: 1,
          text: `这家${prefCuisine}店主打非海鲜类菜品，海鲜过敏者安全`,
          allergySide: '未检测到海鲜/鱼/虾/蟹等元素，海鲜过敏可放心',
          prefSide: `${prefCuisine}偏好已满足`,
          compromise: null,
        };
      }
      if (isJapanese) {
        return {
          resolved: true, tier: 2,
          text: '日料店通常有烤物/拉面/饭类/炸物等非海鲜选项',
          allergySide: '可选照烧鸡饭/拉面/烤鸡皮/炸猪排等非海鲜菜品',
          prefSide: `${prefCuisine}氛围和环境保留，可按自己喜好点`,
          compromise: '海鲜过敏方需从菜单里挑非海鲜项',
        };
      }
      if (isCantonese) {
        return {
          resolved: true, tier: 2,
          text: '粤菜店通常有烧腊/点心/粥粉等非海鲜选项',
          allergySide: '可选烧腊/白切鸡/肠粉/蒸点等非海鲜粤菜',
          prefSide: `${prefCuisine}偏好保留，可自行选择海鲜菜品`,
          compromise: '海鲜过敏方需避开海鲜类菜品',
        };
      }
      const hasAlternatives = allFeatures.includes('面') || allFeatures.includes('饭') || allFeatures.includes('肉') || allFeatures.includes('烤') || allFeatures.includes('炒') || allFeatures.includes('炖') || allFeatures.includes('火锅') || allFeatures.includes('汤');
      if (hasAlternatives) {
        return {
          resolved: true, tier: 3,
          text: '这家店以非海鲜为主，安全可选',
          allergySide: '菜品不含海鲜元素，可放心',
          prefSide: `${prefCuisine}风味基本保持`,
          compromise: null,
        };
      }
      return { resolved: false };
    }
  },
  {
    // 冲突：减肥/低卡 vs 高热量菜系
    // Tier 1：标签有明确低卡/轻食/减脂 关键词
    // Tier 2：日料/粤菜/江浙菜/火锅 → 菜系里有低卡做法
    match: (conflict) => conflict.allergy === '减肥' || conflict.allergy === '低卡',
    resolve: (restaurant, conflict) => {
      const allFeatures = [...(restaurant.tags || []), ...(restaurant.features || []), restaurant.cuisine || '', restaurant.name || ''].join('');
      const prefCuisine = conflict?.preference || '偏好菜系';

      const isLight = allFeatures.includes('轻食') || allFeatures.includes('低卡') || allFeatures.includes('健康') || allFeatures.includes('素') || allFeatures.includes('沙拉') || allFeatures.includes('少糖') || allFeatures.includes('低脂') || allFeatures.includes('清淡');
      if (isLight) {
        return {
          resolved: true, tier: 1,
          text: '这家店有低卡/健康选项',
          allergySide: '有明确低卡/轻食/减脂餐单，可直接选择',
          prefSide: `${prefCuisine}偏好已满足`,
          compromise: null,
        };
      }
      const isJapanese = allFeatures.includes('日料') || allFeatures.includes('日式') || allFeatures.includes('日本料理');
      const isCantonese = allFeatures.includes('粤菜') || allFeatures.includes('广式') || allFeatures.includes('广东');
      const isJiangzhe = allFeatures.includes('江浙菜') || allFeatures.includes('本帮') || allFeatures.includes('杭帮') || allFeatures.includes('淮扬');
      const isHotpot = allFeatures.includes('火锅') || allFeatures.includes('涮');
      if (isJapanese) {
        return { resolved: true, tier: 2,
          text: '日料有蒸物/煮物/沙拉等清淡低卡选项',
          allergySide: '可选蒸蛋/小煮物/沙拉/刺身拼盘等低卡项',
          prefSide: `${prefCuisine}偏好已满足`,
          compromise: '需避开天妇罗/炸猪排等炸物，酱汁少淋',
        };
      }
      if (isCantonese) {
        return { resolved: true, tier: 2,
          text: '粤菜偏清淡，有蒸菜/白灼/煲汤等低卡选项',
          allergySide: '白灼菜/蒸鸡/煲汤/肠粉热量都较低',
          prefSide: `${prefCuisine}偏好已满足`,
          compromise: '需避开蜜汁叉烧/烧鹅等高脂类',
        };
      }
      if (isJiangzhe) {
        return { resolved: true, tier: 2,
          text: '江浙菜偏清淡，通常有蒸菜/汤羹等低卡选项',
          allergySide: '清蒸鱼/菌菇汤/凉拌菜都有',
          prefSide: `${prefCuisine}风味保持`,
          compromise: '需避开红烧/糖醋类偏多糖的菜式',
        };
      }
      if (isHotpot) {
        return { resolved: true, tier: 2,
          text: '火锅可选清汤锅底涮蔬菜/瘦肉/海鲜',
          allergySide: '清汤锅底 + 蔬菜/菌菇/虾/瘦肉，控制蘸料即可',
          prefSide: `${prefCuisine}偏好已满足`,
          compromise: '锅底选清汤/菌汤，麻酱/沙茶酱要少',
        };
      }
      return { resolved: false };
    }
  },
];

function checkCompromise(restaurant, conflict) {
  for (const rule of COMPROMISE_RULES) {
    if (rule.match(conflict)) {
      const result = rule.resolve(restaurant, conflict);
      if (result?.resolved) {
        return result.text || `${conflict.resolution}`;
      }
    }
  }
  return null;
}

// 新接口：返回完整化解详情（tier + 双向解释 + 折中说明）
// 注意：Tier 3 resolved=false 但仍返回详情（弱化解提示），让用户看到"建议到店确认"
export function checkCompromiseDetail(restaurant, conflict) {
  for (const rule of COMPROMISE_RULES) {
    if (rule.match(conflict)) {
      const result = rule.resolve(restaurant, conflict);
      if (!result?.text) return null; // 没命中任何 tier → 不返回详情
      return {
        tier: result.tier || 3,
        resolved: !!result.resolved,
        text: result.text,
        allergySide: result.allergySide,
        prefSide: result.prefSide,
        compromise: result.compromise,
      };
    }
  }
  return null;
}

export function filterByAllergies(restaurants, allergies, conflicts = []) {
  if (!allergies || allergies.length === 0) {
    return restaurants;
  }

  // 群体冲突场景：海鲜过敏 + 有人想吃日料/粤菜等
  // 此时不过滤所有海鲜trait餐厅，只过滤海鲜/寿司/刺身专营店，其余留给冲突化解
  const hasSeafoodConflict = conflicts.some(c => c.allergy === '海鲜' && c.type === 'hard');
  // 群体冲突场景：素食过敏 + 有人想吃烧烤/烤肉/火锅等
  // 此时只过滤主营烤肉/烧烤/火锅的硬荤餐厅，西餐厅/家常菜等留给冲突化解处理
  const hasVegConflict = conflicts.some(c => c.allergy === '素食' && c.type === 'soft_strong');

  // 硬过滤冲突关键词：只对真正危险的偏好词做硬过滤
  // 海鲜冲突中的"日料""粤菜"等宽泛菜系不硬过滤，留给冲突化解处理
  const hardConflictKeywords = new Set();
  conflicts.forEach(c => {
    if (c.type === 'hard') {
      if (c.allergy === '海鲜') return; // 海鲜冲突走专属逻辑，不加入通用硬过滤
      hardConflictKeywords.add(c.preference);
    }
  });

  return restaurants.filter(restaurant => {
    for (const allergy of allergies) {
      if (!HARD_ALLERGIES.includes(allergy) && allergy !== '素食') continue;

      let violates = false;

      if (allergy === '素食') {
        const allText = [...(restaurant.tags || []), ...(restaurant.features || []), restaurant.cuisine || '', restaurant.name || ''].join('');
        // 主营荤菜信号：明确以烤肉/烧烤/炸鸡为主营（素菜选择极少的餐厅类型）
        const heavyMeatSignals = ['烤肉店', '烧烤店', '韩式烤肉', '日式烤肉', '烧肉', '炭烤', '烤串店', '炸鸡店', '美式烧烤', '德国咸猪手'];
        const heavyMeatCount = heavyMeatSignals.filter(s => allText.includes(s)).length;
        // 火锅/串串等汤煮类也有素菜可选，不算硬荤
        const isSteakHouse = allText.includes('牛排馆') || allText.includes('牛排店');
        const isBBQSpecialty = allText.includes('烤肉') || allText.includes('烧烤'); // 有明确主营肉标识

        if (hasVegConflict) {
          // 群体冲突模式：只过滤硬荤专营店
          violates = heavyMeatCount > 0 || isSteakHouse;
        } else {
          // 独享模式：只踢真正的烤肉/烧烤/牛排馆专营店；西餐厅/简餐留给评分软处理
          violates = heavyMeatCount >= 1 || isBBQSpecialty || isSteakHouse;
        }
      } else if (allergy === '海鲜') {
        const allText = [...(restaurant.tags || []), ...(restaurant.features || []), restaurant.cuisine || '', restaurant.name || ''].join('');
        // 海鲜专营信号：餐厅明确以海鲜为主营
        const seafoodSpecialtySignals = ['海鲜', '渔港', '水产', '鱼港', '海鲜自助', '海鲜酒楼', '大排档'];
        const specialtyCount = seafoodSpecialtySignals.filter(s => allText.includes(s)).length;
        // 寿司/刺身专营店信号
        const isSushiSashimi = allText.includes('寿司') || allText.includes('刺身');

        if (hasSeafoodConflict) {
          // 群体冲突模式：只过滤海鲜/寿司/刺身专营店
          violates = specialtyCount > 0 || isSushiSashimi;
        } else {
          // 独享模式：只过滤主营海鲜的餐厅（有2+个海鲜专营信号，或有寿司/刺身专营）
          // 普通餐厅即使有少量海鲜标签（如"鱼""虾"）也不过滤，留给评分降分处理
          violates = specialtyCount >= 2 || isSushiSashimi || allText.includes('海鲜');
        }
      } else if (allergy === '清真') {
        const allText = [...(restaurant.tags || []), ...(restaurant.features || []), restaurant.cuisine || '', restaurant.name || ''].join('');
        // 只硬过滤明确反清真的（猪肉专营/非清真标识），大部分餐厅放行留给评分软处理
        const NON_HALAL_SIGNALS = ['猪肉', '红烧肉', '东坡肉', '回锅肉', '非清真', '大肉'];
        const isExplicitlyNonHalal = NON_HALAL_SIGNALS.some(s => allText.includes(s));
        if (isExplicitlyNonHalal) {
          violates = true;
        } else {
          // 放行，评分阶段加 reason 提示用户确认
          violates = false;
        }
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
export function calculateMemberScore(restaurant, member, groupConflicts = []) {
  // 兜底：如果 member.preferences 为空但 member.text 有内容，重新解析
  let preferences = member.preferences;
  let allergies = member.allergies;
  if ((!preferences || preferences.length === 0) && member.text && member.text.trim()) {
    const reparsed = parseIntent(member.text);
    if (!preferences || preferences.length === 0) preferences = reparsed.preferences;
    if (!allergies || allergies.length === 0) allergies = reparsed.allergies;
  }
  let score = 0;
  const reasons = [];
  let penalty = 0;

  // 维度分数记录（0-100，用于前端展示个人满足度）
  const dimensionScores = {
    cuisine: null,
    allergy: null,
    budget: null,
    distance: null,
    rating: null,
  };

  // 检查该成员的过敏是否被某个冲突化解
  const memberIsResolver = (allergy) => {
    return groupConflicts.some(c =>
      c.allergy === allergy &&
      (c._memberIdB === member._memberId || c.memberName === member.name) &&
      checkCompromise(restaurant, c)
    );
  };

  // 检查当前成员是否是某海鲜冲突的参与方
  // 🔧 修复：旧逻辑"群体里是否有任意海鲜冲突"会把不参与冲突的成员也拖入软约束，
  //         导致 A↔B 海鲜冲突时，成员 C 的海鲜过敏也被错误软处理（扣15分而非硬过滤）
  const memberInSeafoodConflict = () => {
    return groupConflicts.some(c =>
      c.allergy === '海鲜' &&
      (c._memberIdA === member._memberId || c._memberIdB === member._memberId ||
        c.memberName === member.name || c.prefMemberName === member.name)
    );
  };

  const allFeatures = [...(restaurant.tags || []), ...(restaurant.features || []), restaurant.cuisine || '', restaurant.name || ''];
  const allText = allFeatures.join('');

  // 1. 偏好匹配
  if (preferences && preferences.length > 0) {
    let exactMatches = 0;
    let partialMatches = 0;
    let semanticMatches = 0;

    preferences.forEach(pref => {
      const exactMatch = allFeatures.some(f => f === pref);
      // 同义词匹配：寿喜烧等子品类≈偏好，视为精确命中
      const synonymMatch = !exactMatch && featuresMatchPreference(allFeatures, pref);
      // 子串匹配：限制 tag 长度差 <= 4，防止菜品标签误判
      const substringMatch = !exactMatch && !synonymMatch && allFeatures.some(f =>
        (f.includes(pref) && (f.length - pref.length) <= 4) ||
        (pref.includes(f) && f.length >= 2)
      );
      // 语义匹配：菜系等价（如"外国餐厅"≡"西餐"），视为完整命中
      const semanticMatch = !exactMatch && !synonymMatch && !substringMatch && checkSemanticMatch(pref, allFeatures);
      const partialMatch = !exactMatch && !synonymMatch && !substringMatch && checkPrefMatch(pref, allFeatures);
      if (exactMatch || synonymMatch) exactMatches++;
      else if (semanticMatch) semanticMatches++;
      else if (partialMatch || substringMatch) partialMatches++;
    });

    // 语义匹配是菜系等价关系，按完整权重计入 matchRate
    const matchRate = (exactMatches + semanticMatches + partialMatches * 0.7) / preferences.length;
    // 🔧 修复：完全未命中时(matchRate=0)基准分必须**低于无偏好**的45分
    // 有明确想吃川菜却给你推荐沙拉，这种情况应该比"随便吃点"分更低
    const baseScore = matchRate === 0 ? 25 : 55;
    const bonusScore = 45 * powerScale(matchRate, 1.8);
    const cuisineScore = baseScore + bonusScore;
    score += cuisineScore * WEIGHTS.cuisine;
    dimensionScores.cuisine = Math.round(cuisineScore);

    if (exactMatches > 0 || partialMatches > 0 || semanticMatches > 0) {
      const matched = preferences.filter(pref => checkPrefMatch(pref, allFeatures));
      // 子串匹配（如韩式烤肉→烤肉）在展示上视为契合，但不影响评分
      const hasSubstring = preferences.some(pref =>
        allFeatures.some(f =>
          (f.includes(pref) && (f.length - pref.length) <= 4) ||
          (pref.includes(f) && f.length >= 2)
        )
      );
      // 语义匹配（如"外国餐厅"≡"西餐"）是菜系等价，展示为完美契合
      const hasSemantic = preferences.some(pref => checkSemanticMatch(pref, allFeatures));
      reasons.push({
        type: (exactMatches > 0 || hasSubstring || hasSemantic) ? 'match' : 'partial',
        category: 'preference',
        text: (exactMatches > 0 || hasSubstring || hasSemantic)
          ? t('reason.cravePerfect', { name: member.name, cuisines: matched.length > 0 ? matched.join('、') : preferences.join('、') })
          : t('reason.cravePartial', { name: member.name, cuisines: matched.length > 0 ? matched.join('、') : preferences.join('、') })
      });
    }
  } else {
    // 用户有明确偏好但完全未命中时，不能给过高基准分，否则沙拉/咖啡等无关餐厅会"躺着赢"
    score += 45 * WEIGHTS.cuisine;
    // 无菜系偏好 → 维度留空，前端显示"无偏好"
    dimensionScores.cuisine = null;
    if (preferences && preferences.length > 0) {
      reasons.push({
        type: 'mismatch',
        category: 'preference',
        text: t('reason.craveMismatch', { name: member.name, cuisines: preferences.join('、') })
      });
    }
  }

  // 2. 软约束忌口检测
  let allergyResolvedCount = 0;
  if (allergies && allergies.length > 0) {
    allergies.forEach(allergy => {
      const isSoft = SOFT_ALLERGIES.includes(allergy);
      const isStrongSoft = STRONG_SOFT_ALLERGIES.includes(allergy);
      // 海鲜在群体冲突模式下走软约束路径（硬过滤已放行非专营店）
      // 🔧 修复：仅当前成员是该海鲜冲突的参与方才切换到软约束路径
      const isSeafoodConflict = allergy === '海鲜' && memberInSeafoodConflict();
      // 海鲜无冲突时仍需处理：走通用硬过敏评分路径（扣分/适合）
      const isSeafoodNoConflict = allergy === '海鲜' && !isSeafoodConflict;
      if (!isSoft && !isStrongSoft && !isSeafoodConflict && !isSeafoodNoConflict) {
        // 清真：不在此处 return，由下方 else if (allergy === '清真') 处理（检查正向标签+提示电话确认）
        if (allergy === '清真') {
          // deliberately fall through to the halal branch below
        } else if (HARD_ALLERGIES.includes(allergy)) {
          // 坚果/花生/牛奶/乳糖不耐等：硬过滤已放行，直接确认安全
          reasons.push({ type: 'match', category: 'allergy', text: t('reason.allergyPass', { name: member.name, allergies: allergy }) });
          return;
        } else {
          return;
        }
      }

      if (allergy === '海鲜' && isSeafoodConflict) {
        // 群体冲突模式：有seafood trait但非专营的日料/粤菜店扣分，可被冲突化解
        if (memberIsResolver(allergy)) {
          allergyResolvedCount++;
          const resolutionText = checkCompromise(restaurant, groupConflicts.find(c => c.allergy === '海鲜'));
          const evidenceTags = extractSafeTags(restaurant, allergy);
          const fallbackTip = evidenceTags.length === 0 ? getFallbackTip(restaurant, allergy) : '';
          const evidenceText = evidenceTags.length > 0
            ? `，可选：【${evidenceTags.slice(0, 3).join('】【')}】`
            : (fallbackTip ? `，${fallbackTip}` : '');
          reasons.push({ type: 'match', category: 'allergy', text: resolutionText || t('reason.conflictResolved', { resolution: `${member.name}：海鲜冲突已化解${evidenceText}` }) });
          return;
        }
        if (restaurantHasTrait(restaurant, 'seafood')) {
          penalty += 15;
          reasons.push({ type: 'mismatch', category: 'allergy', text: t('reason.allergy', { name: member.name, allergy: '海鲜' }) });
        } else {
          // 餐厅无海鲜元素 → 海鲜过敏方可放心
          reasons.push({ type: 'match', category: 'allergy', text: t('reason.allergyPass', { name: member.name, allergies: '海鲜' }) });
        }
      } else if (allergy === '海鲜' && isSeafoodNoConflict) {
        // 无海鲜冲突（如想吃西餐+海鲜过敏）：硬过滤已放行非专营店，这里做软扣分
        if (memberIsResolver(allergy)) {
          allergyResolvedCount++;
          reasons.push({ type: 'match', category: 'allergy', text: t('reason.allergyPass', { name: member.name, allergies: '海鲜' }) });
          return;
        }
        if (restaurantHasTrait(restaurant, 'seafood')) {
          penalty += 12;
          reasons.push({ type: 'mismatch', category: 'allergy', text: t('reason.allergy', { name: member.name, allergy: '海鲜' }) });
        } else {
          reasons.push({ type: 'match', category: 'allergy', text: t('reason.allergyPass', { name: member.name, allergies: '海鲜' }) });
        }
      } else if (allergy === '素食') {
        const hasMeat = restaurantHasTrait(restaurant, 'meat');
        const hasVegFriendly = restaurantHasTrait(restaurant, 'vegetarian_friendly');
        if (hasMeat) {
          let penaltyAmount = ALLERGY_PENALTY['素食'] || 25;
          if (hasVegFriendly) {
            penaltyAmount = Math.floor(penaltyAmount * 0.4);
            reasons.push({ type: 'partial', category: 'allergy', text: t('reason.allergyVegPartial', { name: member.name }) });
          } else {
            reasons.push({ type: 'mismatch', category: 'allergy', text: t('reason.allergyVegMismatch', { name: member.name }) });
          }
          penalty += penaltyAmount;
        } else {
          // 餐厅无肉 → 素食需求已满足
          reasons.push({ type: 'match', category: 'allergy', text: t('reason.allergyPass', { name: member.name, allergies: '素食' }) });
        }
      } else if (allergy === '清真') {
        // 清真：硬过滤只踢了明确非清真的，此处检查正向标签
        const allText = [...(restaurant.tags || []), ...(restaurant.features || []), restaurant.cuisine || '', restaurant.name || ''].join('');
        const HALAL_SIGNALS = ['清真', 'halal', '回民', '伊斯兰', 'HALAL'];
        const hasHalalTag = HALAL_SIGNALS.some(s => allText.toLowerCase().includes(s.toLowerCase()));
        if (hasHalalTag) {
          reasons.push({ type: 'match', category: 'allergy', text: t('reason.allergyPass', { name: member.name, allergies: '清真' }) });
        } else {
          reasons.push({ type: 'partial', category: 'allergy', text: `标签未标清真，建议${member.name}电话确认` });
          penalty += 5;
        }
      } else {
        const trait = ALLERGY_TRAIT_MAP[allergy];
        if (!trait) return;

        // 冲突化解：该成员的过敏被某个冲突化解，附带安全信号证据
        if (memberIsResolver(allergy)) {
          allergyResolvedCount++;
          const evidenceTags = extractSafeTags(restaurant, allergy);
          const fallbackTip = evidenceTags.length === 0 ? getFallbackTip(restaurant, allergy) : '';
          const evidenceText = evidenceTags.length > 0
            ? `，可选：【${evidenceTags.slice(0, 3).join('】【')}】`
            : (fallbackTip ? `，${fallbackTip}` : '');
          reasons.push({ type: 'match', category: 'allergy', text: t('reason.conflictResolved', { resolution: `${member.name}：${allergy}冲突已化解${evidenceText}` }) });
          return;
        }

        if (restaurantHasTrait(restaurant, trait)) {
          const penaltyAmount = ALLERGY_PENALTY[allergy] || 10;
          penalty += penaltyAmount;
          reasons.push({ type: 'mismatch', category: 'allergy', text: t('reason.allergy', { name: member.name, allergy }) });
        } else {
          // 餐厅无该忌口 trait 且无冲突化解 → 主动 push "避开X，餐厅适合"
          // 避免有忌口的成员在忌口维度看不到任何信息
          reasons.push({ type: 'match', category: 'allergy', text: t('reason.allergyPass', { name: member.name, allergies: allergy }) });
        }
      }
    });
  }

  // 忌口满足度（0-100）：无忌口→null；化解且无惩罚→95；有惩罚→按惩罚递减；否则→100（避开了）
  if (!allergies || allergies.length === 0) {
    dimensionScores.allergy = null;
  } else if (penalty > 0) {
    dimensionScores.allergy = Math.max(0, Math.round(100 - penalty * 3));
  } else if (allergyResolvedCount > 0) {
    dimensionScores.allergy = 95;
  } else {
    dimensionScores.allergy = 100;
  }

  // 3. 预算
  if (member.budget && restaurant.price) {
    const ratio = restaurant.price / member.budget;
    let budgetScore;
    if (ratio <= 1) {
      budgetScore = 85 + (1 - (1 - ratio) * 0.3) * 15;
      reasons.push({ type: 'match', category: 'budget', text: t('reason.budgetOk', { name: member.name }) });
    } else if (ratio <= 1.2) {
      budgetScore = 70 - (ratio - 1) * 100;
      reasons.push({ type: 'partial', category: 'budget', text: t('reason.budgetSlightlyOver', { name: member.name }) });
    } else {
      budgetScore = Math.max(40, 60 - (ratio - 1.2) * 30);
      reasons.push({ type: 'mismatch', category: 'budget', text: t('reason.budgetOver', { name: member.name }) });
    }
    score += budgetScore * WEIGHTS.budget;
    dimensionScores.budget = Math.round(Math.max(0, Math.min(100, budgetScore)));
  } else {
    score += 75 * WEIGHTS.budget;
    // 无预算要求或无价格信息 → 维度留空
    dimensionScores.budget = null;
  }

  // 4. 距离
  // 多人模式：如果成员有独立位置，用 haversine 计算成员到餐厅的独立距离；否则用全局餐厅距离
  let distance = restaurant.distance || 10;
  if (member.memberLocation && member.memberLocation.lat && member.memberLocation.lng && restaurant.lng && restaurant.lat) {
    const meters = haversineDistance(member.memberLocation.lng, member.memberLocation.lat, restaurant.lng, restaurant.lat);
    distance = Math.max(1, Math.round(meters / 80)); // 米 → 步行分钟（80m/min）
  }
  const distanceScore = Math.exp(-distance / 20) * 100;
  score += distanceScore * WEIGHTS.distance;
  dimensionScores.distance = Math.round(Math.max(0, Math.min(100, distanceScore)));
  // 距离 reason：步行分钟数分级提示（多人模式按成员显示）
  if (distance <= 10) {
    reasons.push({ type: 'match', category: 'distance', text: t('reason.distanceNear', { name: member.name, mins: distance }) });
  } else if (distance <= 20) {
    reasons.push({ type: 'match', category: 'distance', text: t('reason.distanceModerate', { name: member.name, mins: distance }) });
  } else {
    reasons.push({ type: 'partial', category: 'distance', text: t('reason.distanceFar', { name: member.name, mins: distance }) });
  }

  // 5. 评分
  const rating = restaurant.rating || 4.2;
  const ratingScore = 60 + powerScale((rating - 3.5) / 1.5, 1.2) * 40;
  const clampedRatingScore = Math.max(60, Math.min(100, ratingScore));
  score += clampedRatingScore * WEIGHTS.rating;
  dimensionScores.rating = Math.round(clampedRatingScore);

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
    const hasPrefs = preferences && preferences.length > 0;
    const hasAllergies = allergies && allergies.length > 0;
    if (hasPrefs) {
      reasons.push({ type: 'mismatch', category: 'preference', text: t('reason.craveMismatch', { name: member.name, cuisines: preferences.join('、') }) });
    } else if (hasAllergies) {
      reasons.push({ type: 'match', category: 'allergy', text: t('reason.allergyPass', { name: member.name, allergies: allergies.join('、') }) });
    } else {
      reasons.push({ type: 'match', category: 'general', text: t('reason.noPrefs', { name: member.name }) });
    }
  }

  const safeScore = (typeof score === 'number' && !isNaN(score) && isFinite(score)) ? score : 60;
  return {
    score: Math.round(safeScore * 10) / 10,
    reasons,
    dimensions: dimensionScores,
    overall: Math.round(Math.max(0, Math.min(100, safeScore))),
  };
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

  // 给每个成员分配稳定 memberId，避免同名覆盖（name 只做展示）
  intent.members.forEach((member, idx) => {
    if (!member._memberId) member._memberId = `m${idx}`;
  });

  // 收集所有成员的偏好
  const allPreferences = [];
  intent.members.forEach(member => {
    if (member.preferences && member.preferences.length > 0) {
      member.preferences.forEach(pref => {
        allPreferences.push({ pref, memberId: member._memberId, memberName: member.name });
      });
    }
  });

  // 推断主导菜系：如果 cuisine 为空，从 tags + features 中推断
  // 优先使用 tags 中的餐厅分类标签（如"火锅店"、"烧烤店"），其次使用 features 中的菜品特征
  const inferCuisine = () => {
    if (restaurant.cuisine) return restaurant.cuisine;
    const allTags = [...(restaurant.tags || []), ...(restaurant.features || [])];
    // 第一轮：找精确匹配（tag 完全等于某个同义词）
    for (const tag of allTags) {
      for (const syns of Object.values(CUISINE_SYNONYMS)) {
        if (syns.includes(tag)) return tag;
      }
    }
    // 第二轮：找子串匹配
    for (const tag of allTags) {
      for (const syns of Object.values(CUISINE_SYNONYMS)) {
        for (const syn of syns) {
          if (tag.includes(syn) && (tag.length - syn.length) <= 4) return syn;
        }
      }
    }
    return '';
  };
  const effectiveCuisine = inferCuisine();

  const allFeatures = [...(restaurant.tags || []), ...(restaurant.features || []), restaurant.cuisine || '', restaurant.name || ''];
  // 融合判定使用两套特征：
  // - fusionCheckFeatures: 主营业务（cuisine + name），用于 style 融合（烤/涮做法）
  //   避免烧烤店因有"水饺"等菜品标签被误判为与火锅融合
  // - flavorCheckFeatures: 全部特征（tags + features + cuisine + name），用于 flavor 融合（麻辣等口味）
  //   口味元素确实需要从菜品特征中提取
  const fusionCheckFeatures = [
    restaurant.cuisine || '',
    restaurant.name || '',
  ].filter(Boolean);
  const flavorCheckFeatures = [
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
        if (allPreferences[i].memberId === allPreferences[j].memberId) continue;

        const fusion = checkFusion(pref1, pref2, fusionCheckFeatures, effectiveCuisine, flavorCheckFeatures);
        if (fusion.canFusion) {
          fusionResults.push({
            ...fusion,
            pref1,
            pref2,
            memberId1: allPreferences[i].memberId,
            memberId2: allPreferences[j].memberId,
            member1: allPreferences[i].memberName,
            member2: allPreferences[j].memberName,
          });
        }
      }
    }
  }

  const activeConflicts = intent.conflicts || [];

  intent.members.forEach(member => {
    const { score, reasons: memberReasons, dimensions, overall } = calculateMemberScore(restaurant, member, activeConflicts);
    // 维度归一化百分比（null 维度前端显示"—"）
    const pct = (v) => (typeof v === 'number' && !isNaN(v)) ? Math.max(0, Math.min(100, Math.round(v))) : null;
    // 多维叠加角色标签（方案B）：有任何维度的明确配置就打标，不依赖冲突是否存在
    const memberRoles = [];
    if (member.allergies && member.allergies.length > 0) {
      memberRoles.push({ key: 'allergy', label: '忌口方', color: '#7C5CFF' });
    }
    if (member.preferences && member.preferences.length > 0) {
      memberRoles.push({ key: 'preference', label: '偏好方', color: '#22C55E' });
    }
    if (member.budget != null && !isNaN(member.budget) && member.budget > 0) {
      memberRoles.push({ key: 'budget', label: '预算方', color: '#D97706' });
    }
    if (member.maxDistance || (member.distRange && (member.distRange[0] > 0 || member.distRange[1] > 0))) {
      memberRoles.push({ key: 'distance', label: '距离方', color: '#2E93D6' });
    }
    memberScores.push({
      member,
      _memberId: member._memberId,
      name: member.name,
      score,
      overall: typeof overall === 'number' ? overall : Math.round(score),
      dimensions: {
        cuisine: pct(dimensions?.cuisine),
        allergy: pct(dimensions?.allergy),
        budget: pct(dimensions?.budget),
        distance: pct(dimensions?.distance),
        rating: pct(dimensions?.rating),
      },
      // 暴露带 category 的成员级原因，前端按维度动态渲染
      reasons: memberReasons,
      roles: memberRoles,
    });
    const hasMismatch = memberReasons.some(r => r.type === 'mismatch');
    // 🔧 修复：满意判定要兼顾理由和实际分数
    // - 有 mismatch（明确不匹配） → 不满足
    // - 综合分 <55（即使全是 partial 也得分偏低） → 不满足
    const finalOverall = typeof overall === 'number' ? overall : Math.round(score);
    if (!hasMismatch && finalOverall >= 55) satisfiedMembers++;
    if (finalOverall >= 80) verySatisfiedMembers++;
    if (finalOverall < 40) unhappyMembers++;
    
    // 存储成员原因，后面根据融合情况再决定是否显示
    memberReasonsMap[member._memberId] = memberReasons;
  });

  const memberCount = intent.members.length;
  const scores = memberScores.map(m => m.score);
  const avgScore = scores.reduce((sum, s) => sum + s, 0) / scores.length;
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const scoreSpread = maxScore - minScore;

  const variance = scores.reduce((sum, s) => sum + Math.pow(s - avgScore, 2), 0) / scores.length;
  const stdDev = Math.sqrt(variance);

  // 公平性聚合：纳什福利（几何平均）天然惩罚短板，maximin（最低分）兜底
  // 算术平均追求总效用，纳什追求均衡，最低分防止"一人低分被高分掩盖"
  const safeScores = scores.map(s => Math.max(20, s)); // log 安全下限
  const logSum = safeScores.reduce((sum, s) => sum + Math.log(s), 0);
  const nashScore = Math.exp(logSum / scores.length); // 几何平均
  const fairAvg = avgScore * 0.4 + nashScore * 0.4 + minScore * 0.2;

  const powerAvg = powerScale(fairAvg / 100, 1.3) * 100;

  // 最低分惩罚：连续函数，不再只在 <50 时触发；与均值差距越大惩罚越重
  // 人数差异化：2人组容忍度低（≈9），8人组容忍度高（≈18）
  // 2人组中一人85一人65（差距20）远比8人组同样差距更严重，惩罚应更重
  const minGap = avgScore - minScore;
  const minGapTolerance = 6 + memberCount * 1.5;
  const minPenalty = minGap > minGapTolerance ? powerScale((minGap - minGapTolerance) / 50, 1.3) * 15 : 0;

  // 标准差惩罚：人数越多可容忍的离散度越大（2人组阈值14，8人组阈值26）
  const stdTolerance = 10 + memberCount * 2;
  const stdPenalty = stdDev > stdTolerance ? powerScale((stdDev - stdTolerance) / 35, 1.3) * 8 : 0;

  // 不满意惩罚：按人数比例归一化，避免大组里1人不满扣分过重
  const unhappyFraction = unhappyMembers / memberCount;
  const unhappyPenalty = unhappyFraction > 0 ? powerScale(unhappyFraction, 1.3) * 12 : 0;

  let groupScore = powerAvg - minPenalty - stdPenalty - unhappyPenalty;

  // 一致性奖励：标准差低于容忍阈值的一半时给奖励
  const consistencyThreshold = stdTolerance / 2;
  if (stdDev < consistencyThreshold) {
    const consistencyBonus = powerScale((consistencyThreshold - stdDev) / consistencyThreshold, 1.3) * 6;
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

    // 三种融合类型独立 if（不再 else if），避免 3+ 人时多类型融合被丢弃
    // 加分逻辑已对每个融合分别加分，这里 fusionDetails / fusionHeader 也要完整聚合
    let perfectHeader = null, flavorHeader = null, styleHeader = null;
    if (perfectFusions.length > 0) {
      groupScore += perfectFusions.length * 8;
      perfectHeader = perfectFusions.length > 1
        ? `${perfectFusions.length}对完美契合`
        : '完美融合';
      perfectFusions.forEach(fusion => {
        fusionDetails.push({ type: 'fusion-detail', fusionType: 'perfect', memberName: fusion.member1, text: fusion.member1Reason });
        fusionDetails.push({ type: 'fusion-detail', fusionType: 'perfect', memberName: fusion.member2, text: fusion.member2Reason });
      });
    }
    if (flavorFusions.length > 0) {
      groupScore += flavorFusions.length * 4;
      flavorHeader = flavorFusions.length > 1
        ? `${flavorFusions.length}对口味融合`
        : '口味融合';
      flavorFusions.forEach(fusion => {
        fusionDetails.push({ type: 'fusion-detail', fusionType: 'flavor', memberName: fusion.member1, text: fusion.member1Reason });
        fusionDetails.push({ type: 'fusion-detail', fusionType: 'flavor', memberName: fusion.member2, text: fusion.member2Reason });
      });
    }
    if (styleFusions.length > 0) {
      // 火锅×烧烤伪融合降权：cuisine 属于日韩系（如居酒屋通过寿喜烧+烧鸟间接命中）
      // 真·烤涮一体店 cuisine 是火锅/烧烤系，拿满分 +6；伪融合只拿 +3
      const JP_KR_CAT = CUISINE_CATEGORIES['日韩系'] || [];
      const cuisineIsJpKr = JP_KR_CAT.includes(restaurant.cuisine);
      let styleBonus = 0;
      styleFusions.forEach(fusion => {
        const isHotpotGrill = (fusion.pref1 === '火锅' && fusion.pref2 === '烧烤') ||
                              (fusion.pref1 === '烧烤' && fusion.pref2 === '火锅');
        styleBonus += (isHotpotGrill && cuisineIsJpKr) ? 3 : 6;
      });
      groupScore += styleBonus;
      styleHeader = styleFusions.length > 1
        ? `${styleFusions.length}对形式融合`
        : '形式融合';
      styleFusions.forEach(fusion => {
        fusionDetails.push({ type: 'fusion-detail', fusionType: 'style', memberName: fusion.member1, text: fusion.member1Reason });
        fusionDetails.push({ type: 'fusion-detail', fusionType: 'style', memberName: fusion.member2, text: fusion.member2Reason });
      });
    }
    // 聚合 fusionHeader：按 perfect → flavor → style 优先级合并文本
    const headerParts = [perfectHeader, flavorHeader, styleHeader].filter(Boolean);
    if (headerParts.length > 0) {
      const dominantType = perfectHeader ? 'perfect' : flavorHeader ? 'flavor' : 'style';
      fusionHeader = {
        type: 'fusion',
        fusionType: dominantType,
        text: headerParts.join(' · '),
      };
    }

    // 融合详情已说明偏好匹配，只保留非偏好类原因（预算、忌口等）
    intent.members.forEach(member => {
      const reasons = memberReasonsMap[member._memberId] || [];
      const nonPrefReasons = reasons.filter(r => r.category !== 'preference');
      allReasons = allReasons.concat(nonPrefReasons);
    });

    // 把融合原因注入到对应成员的 memberScores.reasons，前端直接渲染
    // 把融合原因注入到对应成员的 memberScores.reasons，前端直接渲染
    // 先清除旧的偏好类 reason（如"想吃，完美契合"），再注入融合文案
    fusionResults.forEach(fusion => {
      const ms1 = memberScores.find(ms => ms._memberId === fusion.memberId1);
      if (ms1) {
        ms1.reasons = ms1.reasons.filter(r => r.category !== 'preference');
        ms1.reasons.unshift({ type: 'match', category: 'preference', text: fusion.member1Reason });
      }
      const ms2 = memberScores.find(ms => ms._memberId === fusion.memberId2);
      if (ms2) {
        ms2.reasons = ms2.reasons.filter(r => r.category !== 'preference');
        ms2.reasons.unshift({ type: 'match', category: 'preference', text: fusion.member2Reason });
      }
    });

    // 融合标题 → 融合详情（成员1→成员2顺序）→ 成员原因
    if (fusionHeader) {
      allReasons.unshift(fusionHeader);
    }
    allReasons = [...fusionDetails, ...allReasons];
  } else {
    // 没有融合，直接添加所有成员原因
    intent.members.forEach(member => {
      const reasons = memberReasonsMap[member._memberId] || [];
      allReasons = allReasons.concat(reasons);
    });
  }

  if (activeConflicts.length > 0) {
    let resolvedCount = 0;
    const totalConflicts = activeConflicts.length;

    // 信号数分级加分：化解越有证据，加分越多
    // - 3+ 信号 → +10（证据充足）
    // - 1-2 信号 → +6（有弱信号）
    // - 0 信号 → 不加分（Tier 3 已改为 resolved=false，不会走到这里）
    activeConflicts.forEach(conflict => {
      const resolutionText = checkCompromise(restaurant, conflict);
      if (resolutionText) {
        resolvedCount++;
        const signalCount = countSafeSignals(restaurant, conflict.allergy);
        if (signalCount >= 3) groupScore += 10;
        else if (signalCount >= 1) groupScore += 6;
        else groupScore += 2;
        // 不加入 allReasons：冲突化解详情统一通过 compromiseDetails + 成员级 reasons 展示
      }
    });

    if (resolvedCount === totalConflicts && totalConflicts > 0) {
      groupScore += 10;
      // 不加入 allReasons：化解状态已通过 compromiseDetails + 成员级 reasons 展示，避免与顶部总结重复
    }
  }

  if (memberCount >= 3) {
    const groupBonus = Math.min(8, (memberCount - 2) * 2);
    groupScore += groupBonus;
  }

  // 扩张补偿：扩张来的关联菜系 +8，原始菜系但没信号 -8（stretchScore 之前）
  // 多冲突场景：每条冲突单独算"无信号惩罚"，扩张奖励只给一次（_isExpanded 是整店标记）
  if (activeConflicts.length > 0) {
    if (restaurant._isExpanded) {
      groupScore += 8;
    } else {
      for (const conflict of activeConflicts) {
        const cAllergy = conflict?.allergy;
        if (!cAllergy) continue;
        const sig = countSafeSignals(restaurant, cAllergy);
        if (sig === 0) {
          const allTags = [...(restaurant.tags || []), ...(restaurant.features || []), restaurant.cuisine || '', restaurant.name || ''];
          if (!featuresMatchPreference(allTags, conflict?.preference || '')) groupScore -= 8;
        }
      }
    }
  }

  // 融合关键词加权：真·烤涮一体优先于天然双匹配的伪融合（stretchScore 之前）
  if (restaurant._fusionKeyword && /涮烤|烤涮|火锅烧烤|烤肉火锅|烧烤火锅|涮烤自助/.test(restaurant._fusionKeyword)) {
    groupScore += 10;
  }

  groupScore = stretchScore(groupScore);

  if (intent.members.length > 1) {
    const unsatisfiedCount = intent.members.length - satisfiedMembers;
    let summaryText;
    if (satisfiedMembers === intent.members.length) {
      summaryText = t('reason.groupAllSatisfied');
    } else if (satisfiedMembers === 0) {
      summaryText = t('reason.groupNoneSatisfied');
    } else {
      summaryText = t('reason.groupSatisfied', { satisfied: satisfiedMembers, total: intent.members.length });
      if (unsatisfiedCount > 0) {
        summaryText += '，' + t('reason.groupUnmatched', { count: unsatisfiedCount });
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
        text: t('reason.groupSpread', { low: Math.round(minScore), high: Math.round(maxScore) })
      });
    }

    if (unhappyMembers > 0) {
      allReasons.push({
        type: 'mismatch',
        text: t('reason.groupUnhappy', { count: unhappyMembers })
      });
    }
  }

  if (typeof groupScore !== 'number' || isNaN(groupScore) || !isFinite(groupScore)) {
    groupScore = 75;
  }

  const finalReasons = dedupeReasons(allReasons);

  // 计算每个冲突的化解详情 + 整体 solutionTier（所有冲突里取最坏的 tier）
  // soft 冲突（如辣/素食/减肥）也需要计算 solutionTier，否则 tier 分桶失效，
  // 有点心tag的 Tier1 餐厅和无证据的 Tier3 餐厅混在一起，安全信号优势无法体现
  const groupConflicts = intent.conflicts || [];
  let solutionTier = null;
  const compromiseDetails = [];
  for (const c of groupConflicts) {
    const detail = checkCompromiseDetail(restaurant, c);
    if (detail) {
      compromiseDetails.push({
        conflict: c,
        tier: detail.tier,
        text: detail.text,
        allergySide: detail.allergySide,
        prefSide: detail.prefSide,
        compromise: detail.compromise,
      });
      if (solutionTier === null || detail.tier > solutionTier) {
        solutionTier = detail.tier;
      }
    }
  }
  // 没有任何冲突 → Tier 1（无需化解，完美）
  if (solutionTier === null) solutionTier = 1;

  return {
    score: groupScore,
    reasons: finalReasons,
    _groupMin: minScore,
    _groupAvg: avgScore,
    solutionTier,
    compromiseDetails,
    memberScores: memberScores.slice(),
  };
}

// ============ 单人评分（向后兼容） ============

export function calculateScore(restaurant, intent) {
  return calculateSingleScore(restaurant, intent);
}

export function calculateSingleScore(restaurant, intent) {
  // 用虚拟成员复用 calculateMemberScore，确保忌口评分/原因/维度与多人模式一致
  const virtualMember = {
    name: '我',
    preferences: intent.preferences || [],
    allergies: intent.allergies || [],
    budget: intent.budget || intent.priceRange?.[1] || null,
  };
  const { score: memberScore, reasons: memberReasons, dimensions } =
    calculateMemberScore(restaurant, virtualMember, []);
  return {
    score: memberScore,
    reasons: memberReasons,
    dimensions,
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
        ['火锅烧烤', '烤肉火锅', '火锅烤肉', '涮烤', '烧烤火锅', '涮烤自助', '自助烧烤火锅', '火锅烤肉自助', '烤涮一体', '烤涮'].forEach(k => fusionKeywords.add(k));
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

/**
 * 餐厅特征集合（用于 MMR 相似度计算）
 * 取 cuisine + tags + features，去掉店名（避免同品牌分店被算作"多样"）
 */
function restaurantFeatureSet(r) {
  const set = new Set();
  if (r.cuisine) set.add(r.cuisine);
  (r.tags || []).forEach(t => t && set.add(t));
  (r.features || []).forEach(f => f && set.add(f));
  return set;
}

function jaccardSimilarity(setA, setB) {
  if (setA.size === 0 || setB.size === 0) return 0;
  let inter = 0;
  for (const x of setA) if (setB.has(x)) inter++;
  const union = setA.size + setB.size - inter;
  return union === 0 ? 0 : inter / union;
}

/**
 * MMR（最大边际相关性）多样性重排
 * 在保证相关性的前提下，尽量降低已选餐厅之间的菜系/标签重叠。
 * 采用贪心选择，返回按 MMR 分数降序的完整列表（不截断），
 * 上层 tierBuckets 仍可从中按方案层级挑选，保证 Tier 覆盖。
 *
 * @param {Array} scoredRestaurants 已按 tier+matchScore 排序的候选
 * @param {object} intent
 * @param {object|number} options { lambda, skipFirstN, enableForSolo } 或旧式 lambda 数值
 */
export function mmrRerank(scoredRestaurants, intent, options = {}) {
  const {
    lambda = 0.6,
    skipFirstN = 0,
    enableForSolo = false,
  } = typeof options === 'number' ? { lambda: options } : options;

  if (!scoredRestaurants || scoredRestaurants.length <= 1) {
    return scoredRestaurants || [];
  }
  // 单人模式 / 无成员信息：仅当显式启用时才走 MMR
  const isSolo = !intent || !intent.members || intent.members.length < 2;
  if (isSolo && !enableForSolo) {
    return scoredRestaurants;
  }

  const candidates = scoredRestaurants.map(r => ({
    r,
    features: restaurantFeatureSet(r),
    rel: (typeof r.matchScore === 'number' && !isNaN(r.matchScore)) ? r.matchScore / 100 : 0.6,
  }));

  // 归一化相关性到 [0,1]，避免分数尺度影响 λ 权衡
  const rels = candidates.map(c => c.rel);
  const relMin = Math.min(...rels);
  const relMax = Math.max(...rels);
  const relRange = relMax - relMin;
  candidates.forEach(c => {
    c.relNorm = relRange > 0.001 ? (c.rel - relMin) / relRange : 0.8;
  });

  // 前 skipFirstN 个保持原排序（保 Top1 相关性），但仍参与相似度计算
  const skipped = candidates.splice(0, Math.min(skipFirstN, candidates.length));
  const remaining = [...candidates];
  const selected = [...skipped];

  // 首选：相关性最高（且 tier 最低已在排序里体现）
  remaining.sort((a, b) => b.relNorm - a.relNorm);
  selected.push(remaining.shift());

  while (remaining.length > 0) {
    let bestIdx = 0;
    let bestScore = -Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const cand = remaining[i];
      let maxSim = 0;
      for (const s of selected) {
        const sim = jaccardSimilarity(cand.features, s.features);
        if (sim > maxSim) maxSim = sim;
      }
      const mmr = lambda * cand.relNorm - (1 - lambda) * maxSim;
      if (mmr > bestScore) {
        bestScore = mmr;
        bestIdx = i;
      }
    }
    selected.push(remaining.splice(bestIdx, 1)[0]);
  }

  return selected.map(c => c.r);
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
    '火锅': ['火锅', '涮锅', '铜锅', '涮肉', '打边炉', '寿喜烧', '寿喜锅', '涮涮锅', '锅物', '涮羊肉', '羊肉火锅', '牛肉火锅', '粥底火锅', '椰子鸡', '豆捞', '泰式火锅', '日式火锅', '小火锅', '转转火锅'],
    '川菜': ['川菜', '四川菜', '重庆菜', '川味'],
    '湘菜': ['湘菜', '湖南菜', '湘味'],
    '粤菜': ['粤菜', '广东菜', '广式', '茶餐厅', '烧腊', '潮汕'],
    '日料': ['日料', '日本料理', '日式', '寿司', '居酒屋', '定食'],
    '韩餐': ['韩餐', '韩国料理', '韩式', '韩国烤肉', '部队锅'],
    '东北菜': ['东北菜', '东北菜馆', '东北饺子', '锅包肉', '杀猪菜'],
    '新疆菜': ['新疆菜', '新疆菜馆', '大盘鸡', '羊肉串', '烤羊肉'],
    '江浙菜': ['江浙菜', '本帮菜', '杭帮菜', '上海菜', '淮扬菜'],
    '海鲜': ['海鲜', '鱼鲜', '水产', '大排档'],
    '轻食': ['轻食', '沙拉', '健康餐', '素食'],
    '面馆': ['面馆', '拉面', '米粉', '面食', '牛肉面'],
    '快餐': ['快餐', '便当', '汉堡', '炸鸡'],
    '冒菜': ['冒菜', '麻辣烫', '串串'],
    '麻辣烫': ['麻辣烫', '冒菜', '串串'],
    '串串': ['串串', '麻辣烫', '冒菜', '火锅'],
    '烧鸟': ['烧鸟', '居酒屋', '日式烧烤', '日料'],
    '自助餐': ['自助', '自助餐', '海鲜自助', '烤肉自助'],
    '饺子': ['饺子', '水饺', '蒸饺', '锅贴', '小笼包'],
    '包子': ['包子', '小笼包', '汤包', '锅贴', '饺子'],
    '咖啡': ['咖啡', '咖啡厅', '咖啡馆', '下午茶'],
    '奶茶': ['奶茶', '饮品', '下午茶'],
    '甜品': ['甜品', '蛋糕', '面包', '点心', '下午茶'],
    '北京菜': ['北京菜', '京菜', '烤鸭', '涮羊肉', '京味'],
    '西北菜': ['西北菜', '陕西菜', '兰州拉面', '牛肉面', '羊肉泡馍'],
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

	// CUISINE_WHITELIST: known cuisine/category names.
	// LLM keywords in this set → display as preferences; not in set → search-only
	export const CUISINE_WHITELIST = new Set([
	  '烤肉',	  '烧烤',	  '火锅',	  '日料',	  '韩餐',	  '韩国料理',	  '西餐',	  '川菜',	  '湘菜',	  '粤菜',	  '江浙菜',	  '东北菜',	  '西北菜',	  '云南菜',	  '贵州菜',	  '北京菜',	  '鲁菜',	  '江西菜',	  '福建菜',	  '广西菜',	  '新疆菜',	  '海鲜',	  '沙拉',	  '轻食',	  '健康餐',	  '快餐',	  '面馆',	  '饺子',	  '包子',	  '粥',	  '汤',	  '烧腊',	  '卤味',	  '潮汕菜',	  '本帮菜',	  '杭帮菜',	  '淮扬菜',	  '意面',	  '披萨',	  '东南亚菜',	  '泰菜',	  '越南菜',	  '咖啡',	  '奶茶',	  '甜品',	  '小吃',	  '撸串',	  '冒菜',	  '麻辣烫',	  '串串',	  '烧鸟',	  '自助餐',	  '自助',	  '汉堡',	  '炸鸡',	  '牛排',	  '咖喱',	  '喝',	  '意大利菜',	  '牛肉面',	  '酸菜鱼',	  '烤鱼',	  '涮羊肉',	  '烤鸭',	  '酸汤鱼',	  '螺蛳粉',	  '沙茶面',	  '小笼包',	  '炒菜',	  '简餐',	  '便当'
	]);

	// ABSTRACT_WORDS: should NOT be used as Amap search keywords
	// or matched against restaurant tags
	const ABSTRACT_WORDS = new Set([
	  '清淡',	  '热乎',	  '重口味',	  '下饭',	  '暖和',	  '甜的',	  '甜食',	  '随便',	  '随便吃点',	  '快',	  '慢',	  '环境好',	  '便宜',	  '贵',	  '实惠',	  '高档',	  '好吃',	  '正宗',	  'light',	  'heavy',	  'warm',	  'cheap',	  'expensive',	  'fancy',	  'quiet',	  'lively',	  'spicy',	  'sweet'
	]);



// 过敏感知搜索关键词过滤：移除扩张子词中与过敏冲突的关键词
// 避免搜索结果过度偏向过敏方向（如不吃辣 → 川菜扩张中移除"麻辣"）
const ALLERGY_FILTER_RULES = [
  {
    allergy: '辣',
    remove: [
      '麻辣', '麻辣烫', '冒菜', '串串', '部队锅', '香辣', '辣味', '红油', '泡椒', '水煮', '剁椒',
    ],
  },
  {
    allergy: '素食',
    remove: [
      '锅包肉', '杀猪菜', '羊肉串', '烤羊肉', '烤鸭', '涮羊肉',
      '韩国烤肉', '韩式烤肉', '烤肉自助', '汉堡', '炸鸡', '牛排', '烤肉',
    ],
  },
  {
    allergy: '海鲜',
    remove: [
      '海鲜自助', '海鲜酒楼', '大排档', '水产',
    ],
  },
];

	export function filterExpansionsByAllergies(keywords, allergies) {
	  if (!allergies || allergies.length === 0) return keywords;
	  const toRemove = new Set();
	  allergies.forEach(allergy => {
	    const rule = ALLERGY_FILTER_RULES.find(r => r.allergy === allergy);
	    if (rule) rule.remove.forEach(k => toRemove.add(k));
	  });
	  if (toRemove.size === 0) return keywords;
	  const parts = keywords.split('|');
	  let filtered = parts.filter(k => !toRemove.has(k));
	  // 辣忌口：给辣系菜系搜索词追加温和变体，从搜索源头增加不辣命中率
	  // 必须在空检查之前执行——即使 filtered 为空也要追加备选词
	  if (allergies.includes('辣')) {
	    const SPICY_ROOTS = ['川菜', '湘菜', '贵州菜', '江西菜', '四川菜', '重庆菜', '云南菜'];
	    SPICY_ROOTS.forEach(root => {
	      if (filtered.includes(root)) {
	        filtered.push('不辣' + root, '改良' + root, '新派' + root, root + '馆');
	      }
	    });
	  }
	  if (filtered.length === 0) return '';
	  return filtered.join('|');
	}
// CUISINE_KEYWORDS_FOR_FILTER / CUISINE_SEMANTIC_MAP 已迁移到 src/data/cuisineMap.js

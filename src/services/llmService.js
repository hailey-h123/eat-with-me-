import { parseWithLLM, isLLMAvailable } from './llmClient';
import { CUISINE_KEYWORDS, CUISINE_TRAITS } from '../data/cuisineMap';

// 已知菜系/品类名白名单（LLM 搜索词在此→偏好展示；不在→仅搜索）
const KNOWN_CUISINE = new Set([
  '烤肉','烧烤','火锅','日料','韩餐','韩国料理','西餐','川菜','湘菜','粤菜','江浙菜',
  '东北菜','西北菜','云南菜','贵州菜','北京菜','鲁菜','江西菜','福建菜','广西菜','新疆菜',
  '海鲜','沙拉','轻食','健康餐','快餐','面馆','饺子','包子','粥','汤','烧腊','卤味',
  '潮汕菜','本帮菜','杭帮菜','淮扬菜','意面','披萨','东南亚菜','泰菜','越南菜',
  '咖啡','奶茶','甜品','小吃','撸串','冒菜','麻辣烫','串串','烧鸟','自助餐','自助',
  '汉堡','炸鸡','牛排','咖喱','喝','意大利菜',
  '牛肉面','酸菜鱼','烤鱼','涮羊肉','烤鸭','酸汤鱼','螺蛳粉','沙茶面','小笼包','炒菜','简餐','便当',
]);

const ALLERGY_KEYWORDS = ['不吃辣', '忌辣', '不要辣', '怕辣', '不能吃辣', '辣椒', '辣的', '麻辣', '香辣', '不吃辣的', '怕辣的'];
const CILANTRO_KEYWORDS = ['不吃香菜', '忌香菜', '不要香菜', '讨厌香菜', '不爱香菜', '不吃芫荽'];
const HALAL_KEYWORDS = ['清真', '回民', '穆斯林'];
const VEGETARIAN_KEYWORDS = ['素食', '素菜', '不吃肉', '全素', '纯素'];
const DIET_KEYWORDS = ['减肥', '减脂', '瘦身', '低卡', '健康', '轻食', '健身餐', '控卡'];
const DRINK_KEYWORDS = ['喝', '奶茶', '咖啡', '饮品', '饮料', '下午茶'];
const HOTPOT_KEYWORDS = ['火锅', '涮锅', '打边炉'];
const NOISY_KEYWORDS = ['热闹', '人多', '聚餐', '聚会', '团建', '生日'];
const QUIET_KEYWORDS = ['安静', '聊天', '约会', '私密', '浪漫'];
const SOUP_KEYWORDS = ['汤', '热汤', '暖胃', '面汤', '喝汤'];
const LIGHT_KEYWORDS = ['清淡', '不油', '少油', '健康', '养生'];
const SEAFOOD_KEYWORDS = ['不吃海鲜', '忌海鲜', '海鲜过敏', '海鲜不吃'];
const NUT_KEYWORDS = ['坚果过敏', '不吃坚果', '坚果不吃'];
const MEAT_KEYWORDS = ['吃肉', '肉食', '无肉不欢'];
const SPICY_KEYWORDS = ['想吃辣', '要辣', '辣一点', '很辣', '麻辣'];
const SWEET_KEYWORDS = ['想吃甜的', '甜食', '甜点'];
const SALTY_KEYWORDS = ['咸的', '重口味', '咸香'];
const SOUR_KEYWORDS = ['酸的', '酸辣', '开胃'];
const CHEAP_KEYWORDS = ['便宜', '实惠', '性价比', '不贵'];
const EXPENSIVE_KEYWORDS = ['高档', '贵一点', '精致', '环境好'];

// ===== English keyword equivalents (map to same internal tokens) =====

// Allergies (EN → internal token)
const EN_ALLERGY_KEYWORDS = {
  '辣': ['no spicy', 'not spicy', "can't eat spicy", 'no spice', 'not hot', 'mild only', 'i don\'t eat spicy', 'no chili', 'can not handle spicy'],
  '香菜': ['no cilantro', 'no coriander', 'hate cilantro', 'no culantro'],
  '清真': ['halal', 'muslim'],
  '素食': ['vegetarian', 'vegan', 'plant-based', 'no meat', 'veggie', 'veg only', 'vegan only'],
  '海鲜': ['no seafood', 'seafood allergy', 'allergic to seafood', 'no fish', 'no shellfish', 'allergic to fish'],
  '坚果': ['nut allergy', 'no nuts', 'allergic to nuts', 'nut free'],
  '减肥': ['diet', 'dieting', 'low calorie', 'low cal', 'losing weight', 'cutting', 'lean', 'healthy options'],
};

// Preferences (EN → internal token)
const EN_PREFERENCE_KEYWORDS = {
  '火锅': ['hot pot', 'hotpot', 'steamboat', 'shabu shabu', 'shabu', 'sukiyaki', 'boil pot', 'chinese fondue'],
  '烤肉': ['korean bbq', 'kbbq', 'bbq', 'barbecue', 'barbeque', 'grill', 'grilled meat', 'yakiniku', 'galbi', 'bulgogi'],
  '日料': ['japanese food', 'japanese cuisine', 'japanese', 'sushi', 'sashimi', 'ramen', 'izakaya', 'donburi', 'udon', 'tempura', 'tonkatsu'],
  '韩餐': ['korean food', 'korean cuisine', 'korean', 'bibimbap', 'tteokbokki', 'japchae', 'kimchi', 'korean fried chicken'],
  '川菜': ['sichuan', 'szechuan', 'sichuan food', 'szechuan cuisine', 'chongqing', 'mala', 'mapo tofu', 'dan dan noodles'],
  '湘菜': ['hunan', 'hunan food', 'xiang cuisine', 'hunan cuisine', 'spicy hunan'],
  '粤菜': ['cantonese', 'canton food', 'dim sum', 'guangdong food', 'cantonese cuisine', 'char siu', 'wonton', 'congee'],
  '江浙菜': ['jiangzhe', 'shanghainese', 'shanghai food', 'hangzhou food', 'nanjing', 'xiao long bao', 'soup dumpling', 'dongpo pork', 'lion head meatball'],
  '东北菜': ['dongbei', 'northeastern chinese', 'manchurian', 'guo bao rou', 'di san xian'],
  '西北菜': ['northwest chinese', 'xi\'an food', 'lanzhou', 'lamb skewer', 'biang biang noodles', 'hand pulled noodles', 'cumin lamb'],
  '北京菜': ['beijing food', 'peking duck', 'beijing cuisine', 'zhajiangmian', 'beijing noodles'],
  '云南菜': ['yunnan food', 'yunnan cuisine', 'crossing bridge noodles', 'rice noodle'],
  '贵州菜': ['guizhou food', 'guizhou cuisine', 'sour soup fish', 'sour and spicy'],
  '西餐': ['western food', 'western cuisine', 'steak', 'steakhouse', 'italian food', 'italian', 'french food', 'french cuisine', 'american food', 'pasta', 'risotto'],
  '披萨': ['pizza', 'pizzeria'],
  '东南亚菜': ['southeast asian', 'thai food', 'thai', 'vietnamese food', 'vietnamese', 'pho', 'banh mi', 'pad thai', 'tom yum', 'singapore food', 'malaysian'],
  '泰菜': ['thai food', 'thai cuisine', 'thai', 'tom yum', 'pad thai', 'green curry', 'red curry', 'pad kra pao'],
  '越南菜': ['vietnamese', 'pho', 'banh mi', 'vietnamese food', 'bun bo hue'],
  '面馆': ['noodles', 'noodle soup', 'lamian', 'ramen', 'noodle spot', 'pulled noodles', 'soup noodles'],
  '饺子': ['dumplings', 'dumpling', 'jiaozi', 'gyoza', 'pot stickers', 'potstickers', 'pierogi'],
  '快餐': ['fast food', 'burger', 'burgers', 'fried chicken', 'mcdonald', 'kfc', 'quick bite', 'fast casual', 'takeout'],
  '轻食': ['light meal', 'salad', 'healthy food', 'clean eating', 'poke bowl', 'grain bowl', 'smoothie bowl', 'low carb'],
  '海鲜': ['seafood', 'fish', 'crab', 'lobster', 'oyster', 'shellfish', 'shrimp', 'prawn', 'sashimi boat'],
  '甜品': ['dessert', 'cake', 'pastry', 'ice cream', 'sweet', 'gelato', 'tiramisu', 'cheesecake', 'boba shop', 'bubble tea shop'],
  '咖啡': ['coffee', 'cafe', 'latte', 'espresso', 'americano', 'cappuccino', 'matcha', 'cafe latte'],
  '烧烤': ['bbq', 'barbecue', 'barbeque', 'skewer', 'chinese bbq', 'chuanr', 'grill', 'charcoal grill'],
  '撸串': ['skewer', 'chuanr', 'kebab', 'street bbq', 'late night grill'],
  '小吃': ['street food', 'snack', 'tapas', 'small plates', 'appetizers'],
  '喝': ['drinks', 'beverage', 'boba', 'bubble tea', 'milkshake', 'smoothie', 'juice bar'],
  '咖喱': ['curry', 'indian food', 'indian cuisine', 'indian', 'butter chicken', 'tikka masala', 'naan'],
};

// Budget patterns (EN)
const EN_BUDGET_PATTERNS = {
  above: [/\b(?:budget|spend|price|cost)\b[^.!?]*\b(?:over|above|at least|more than|minimum|min)\b[^.!?]*?\$?(\d+)/i, /\$(?:(\d+)\+|\+?\$?(\d+)\s*(?:\+|and above|or more|or up))/i, /(\d+)\s*(?:\+|and above|or more|or up)\s*(?:dollars|yuan|bucks|rmb)?/i],
  around: [/\b(?:budget|spend|price|cost)\b[^.!?]*\b(?:around|about|approximately|roughly|near|around)\b[^.!?]*?\$?(\d+)/i, /\$?(\d+)\s*(?:ish|around|or so)/i],
  max: [/\b(?:budget|spend|price|cost)\b[^.!?]*\b(?:under|below|within|max|maximum|up to|no more than|at most)\b[^.!?]*?\$?(\d+)/i, /\$?(\d+)\s*(?:or less|or under|or below|max)/i, /\bunder\s*\$?(\d+)/i, /\bwithin\s*\$?(\d+)/i],
};

// ===== Helpers =====

// Check if text is primarily English (heuristic: >60% ASCII alphabetic chars)
function isEnglishText(text) {
  if (!text) return false;
  const alpha = (text.match(/[a-zA-Z]/g) || []).length;
  const cjk = (text.match(/[一-鿿㐀-䶿]/g) || []).length;
  return alpha > cjk && alpha > text.length * 0.3;
}

// CUISINE_KEYWORDS 已迁移到 src/data/cuisineMap.js

const ALLERGY_CUISINE_MAP = {
  '辣': ['川菜', '湘菜', '火锅'],
  '海鲜': ['海鲜'],
  '素食': ['烤肉', '火锅', '西餐', '川菜', '湘菜'],
};

export function parseIntent(text) {
  const result = {
    location: '',
    peopleCount: 1,
    preferences: [],
    allergies: [],
    budget: null,       // 预算上限（"80以内" → 80，"80左右" → 104）
    minBudget: null,    // 预算下限（"100以上" → 100）
    atmosphere: '',
    shopType: '',
    cuisines: [],
  };

  if (!text || text.trim() === '') {
    return result;
  }

  const trimmedText = text.trim();

  // 预算识别：以上 / 以内 / 以下 / 左右 / 上下 / 及以上
  const budgetAbove = trimmedText.match(/预算(?:人均)?(\d+)(?:以上|及以上)/);
  const budgetAround = trimmedText.match(/预算(?:人均)?(\d+)(?:左右|上下|附近)/);
  const budgetMax = trimmedText.match(/预算(?:人均)?(\d+)(?:以内|以下|之下)?/);
  if (budgetAbove) {
    result.minBudget = parseInt(budgetAbove[1], 10);
    result.budget = null; // 无上限
  } else if (budgetAround) {
    const mid = parseInt(budgetAround[1], 10);
    result.minBudget = Math.max(0, Math.round(mid * 0.7));
    result.budget = Math.round(mid * 1.3);
  } else if (budgetMax) {
    result.budget = parseInt(budgetMax[1], 10);
  }

  const peopleMatch = trimmedText.match(/(我和)?(\d+)(?:个|位)?(?:朋友|同事|人)/);
  if (peopleMatch && peopleMatch[2]) {
    result.peopleCount = parseInt(peopleMatch[2], 10);
  }

  const locationMatch = trimmedText.match(/在(.*?)(?:，|。|、|\s)/);
  if (locationMatch) {
    const loc = locationMatch[1].trim();
    if (loc.length > 0 && loc.length < 20) {
      result.location = loc;
    }
  }

  ALLERGY_KEYWORDS.forEach(keyword => {
    if (trimmedText.includes(keyword) && !result.allergies.includes('辣')) {
      result.allergies.push('辣');
    }
  });

  CILANTRO_KEYWORDS.forEach(keyword => {
    if (trimmedText.includes(keyword) && !result.allergies.includes('香菜')) {
      result.allergies.push('香菜');
    }
  });

  HALAL_KEYWORDS.forEach(keyword => {
    if (trimmedText.includes(keyword) && !result.allergies.includes('清真')) {
      result.allergies.push('清真');
    }
  });

  VEGETARIAN_KEYWORDS.forEach(keyword => {
    if (trimmedText.includes(keyword)) {
      if (!result.allergies.includes('素食')) {
        result.allergies.push('素食');
      }
      if (!result.preferences.includes('素食')) {
        result.preferences.push('素食');
      }
    }
  });

  DIET_KEYWORDS.forEach(keyword => {
    if (trimmedText.includes(keyword) && !result.preferences.includes('减肥')) {
      result.preferences.push('减肥');
    }
  });

  DRINK_KEYWORDS.forEach(keyword => {
    if (trimmedText.includes(keyword) && !result.preferences.includes('饮品')) {
      result.preferences.push('饮品');
    }
  });

  HOTPOT_KEYWORDS.forEach(keyword => {
    if (trimmedText.includes(keyword)) {
      if (!result.preferences.includes('火锅')) {
        result.preferences.push('火锅');
      }
      if (!result.shopType) {
        result.shopType = '火锅';
      }
    }
  });

  SOUP_KEYWORDS.forEach(keyword => {
    if (trimmedText.includes(keyword) && !result.preferences.includes('热汤')) {
      result.preferences.push('热汤');
    }
  });

  LIGHT_KEYWORDS.forEach(keyword => {
    if (trimmedText.includes(keyword) && !result.preferences.includes('清淡')) {
      result.preferences.push('清淡');
    }
  });

  SEAFOOD_KEYWORDS.forEach(keyword => {
    if (trimmedText.includes(keyword) && !result.allergies.includes('海鲜')) {
      result.allergies.push('海鲜');
    }
  });

  NUT_KEYWORDS.forEach(keyword => {
    if (trimmedText.includes(keyword) && !result.allergies.includes('坚果')) {
      result.allergies.push('坚果');
    }
  });

  MEAT_KEYWORDS.forEach(keyword => {
    if (trimmedText.includes(keyword) && !result.preferences.includes('吃肉')) {
      result.preferences.push('吃肉');
    }
  });

  SPICY_KEYWORDS.forEach(keyword => {
    if (trimmedText.includes(keyword) && !result.preferences.includes('辣')) {
      result.preferences.push('辣');
    }
  });

  SWEET_KEYWORDS.forEach(keyword => {
    if (trimmedText.includes(keyword) && !result.preferences.includes('甜食')) {
      result.preferences.push('甜食');
    }
  });

  SALTY_KEYWORDS.forEach(keyword => {
    if (trimmedText.includes(keyword) && !result.preferences.includes('咸香')) {
      result.preferences.push('咸香');
    }
  });

  SOUR_KEYWORDS.forEach(keyword => {
    if (trimmedText.includes(keyword) && !result.preferences.includes('酸辣')) {
      result.preferences.push('酸辣');
    }
  });

  let cheapCount = 0;
  let expensiveCount = 0;
  CHEAP_KEYWORDS.forEach(keyword => {
    if (trimmedText.includes(keyword)) cheapCount++;
  });
  EXPENSIVE_KEYWORDS.forEach(keyword => {
    if (trimmedText.includes(keyword)) expensiveCount++;
  });

  if (cheapCount > expensiveCount) {
    if (!result.preferences.includes('实惠')) {
      result.preferences.push('实惠');
    }
  } else if (expensiveCount > cheapCount) {
    if (!result.preferences.includes('高档')) {
      result.preferences.push('高档');
    }
  }

  let noisyCount = 0;
  let quietCount = 0;
  NOISY_KEYWORDS.forEach(keyword => {
    if (trimmedText.includes(keyword)) noisyCount++;
  });
  QUIET_KEYWORDS.forEach(keyword => {
    if (trimmedText.includes(keyword)) quietCount++;
  });

  if (noisyCount > quietCount) {
    result.atmosphere = '热闹';
  } else if (quietCount > noisyCount) {
    result.atmosphere = '安静';
  }

  for (const [cuisine, keywords] of Object.entries(CUISINE_KEYWORDS)) {
    // 跳过已被识别为过敏的菜系（如"不吃海鲜"→ allergies 已含"海鲜"，不应再加入 preferences）
    if (result.allergies.includes(cuisine)) continue;
    if (keywords.some(k => trimmedText.includes(k))) {
      if (!result.preferences.includes(cuisine)) {
        result.preferences.push(cuisine);
      }
      if (!result.cuisines.includes(cuisine)) {
        result.cuisines.push(cuisine);
      }
      if (!result.shopType) {
        result.shopType = cuisine;
      }
    }
  }

  // ===== English input parsing =====
  if (isEnglishText(trimmedText)) {
    const lowerText = trimmedText.toLowerCase();

    // Budget
    if (!result.budget && !result.minBudget) {
      for (const p of EN_BUDGET_PATTERNS.above) {
        const m = lowerText.match(p);
        if (m) { const v = parseInt(m[1] || m[2]); if (v) { result.minBudget = v; result.budget = null; break; } }
      }
      if (!result.budget) {
        for (const p of EN_BUDGET_PATTERNS.around) {
          const m = lowerText.match(p);
          if (m) { const v = parseInt(m[1] || m[2]); if (v) { result.minBudget = Math.max(0, Math.round(v * 0.7)); result.budget = Math.round(v * 1.3); break; } }
        }
      }
      if (!result.budget) {
        for (const p of EN_BUDGET_PATTERNS.max) {
          const m = lowerText.match(p);
          if (m) { const v = parseInt(m[1] || m[2]); if (v) { result.budget = v; break; } }
        }
      }
    }

    // Allergies
    for (const [token, keywords] of Object.entries(EN_ALLERGY_KEYWORDS)) {
      if (keywords.some(k => lowerText.includes(k))) {
        if (!result.allergies.includes(token)) result.allergies.push(token);
      }
    }

    // Preferences / Cuisines
    for (const [token, keywords] of Object.entries(EN_PREFERENCE_KEYWORDS)) {
      if (keywords.some(k => lowerText.includes(k))) {
        if (!result.preferences.includes(token)) result.preferences.push(token);
        if (!result.cuisines.includes(token)) result.cuisines.push(token);
        if (!result.shopType) result.shopType = token;
      }
    }

    // Cheap / expensive
    const cheapEn = ['cheap', 'affordable', 'budget friendly', 'inexpensive', 'good value', 'cheap eats', 'not expensive'];
    const expensiveEn = ['fancy', 'upscale', 'expensive', 'high-end', 'high end', 'fine dining', 'nice restaurant', 'treat myself', 'splurge'];
    if (cheapEn.some(k => lowerText.includes(k))) { if (!result.preferences.includes('实惠')) result.preferences.push('实惠'); }
    if (expensiveEn.some(k => lowerText.includes(k))) { if (!result.preferences.includes('高档')) result.preferences.push('高档'); }

    // Atmosphere
    const quietEn = ['quiet', 'calm', 'romantic', 'intimate', 'date night', 'chat', 'talk', 'conversation', 'not too loud', 'not loud'];
    const noisyEn = ['lively', 'bustling', 'loud', 'party', 'celebration', 'birthday', 'fun atmosphere', 'vibrant'];
    if (quietEn.some(k => lowerText.includes(k))) result.atmosphere = '安静';
    if (noisyEn.some(k => lowerText.includes(k))) result.atmosphere = '热闹';

    // Soup / warm
    const soupEn = ['soup', 'broth', 'stew', 'warm food', 'comfort food', 'hot soup', 'noodle soup', 'hot bowl'];
    if (soupEn.some(k => lowerText.includes(k))) { if (!result.preferences.includes('热汤')) result.preferences.push('热汤'); }

    // Light / healthy
    const lightEn = ['light food', 'light meal', 'light', 'not heavy', 'clean eating', 'clean food'];
    if (lightEn.some(k => lowerText.includes(k))) { if (!result.preferences.includes('清淡')) result.preferences.push('清淡'); }

    // Drink
    const drinkEn = ['drink', 'drinks', 'bar', 'cocktail', 'pub', 'brewery', 'wine bar', 'bubble tea', 'boba', 'milk tea', 'matcha latte'];
    if (drinkEn.some(k => lowerText.includes(k))) { if (!result.preferences.includes('饮品')) result.preferences.push('饮品'); }

    // Sweet / dessert
    const sweetEn = ['sweet tooth', 'sweet', 'dessert', 'ice cream', 'cake', 'pastry', 'candy', 'chocolate', 'gelato', 'tiramisu'];
    if (sweetEn.some(k => lowerText.includes(k))) { if (!result.preferences.includes('甜食')) result.preferences.push('甜食'); }

    // Spicy craving (not allergy — "I want spicy")
    const spicyCraveEn = ['want spicy', 'love spicy', 'craving spicy', 'spicy food', 'spicy please', 'extra spicy'];
    if (spicyCraveEn.some(k => lowerText.includes(k))) { if (!result.preferences.includes('辣')) result.preferences.push('辣'); }

    // Meat craving
    const meatEn = ['meat lover', 'carnivore', 'need meat', 'want meat', 'steak', 'bbq', 'roast', 'beef', 'pork', 'lamb', 'chicken wings'];
    if (meatEn.some(k => lowerText.includes(k))) { if (!result.preferences.includes('吃肉')) result.preferences.push('吃肉'); }
  }

  return result;
}

/**
 * 解析单个成员的输入
 * @param {string} text - 成员的偏好描述
 * @param {string} name - 成员名称
 * @returns {Object} 成员意图对象
 */
export function parseMemberIntent(text, name = '成员', memberLocation = null) {
  const intent = parseIntent(text);
  return {
    name: name,
    text: text,
    preferences: intent.preferences,
    allergies: intent.allergies,
    atmosphere: intent.atmosphere,
    budget: intent.budget,
    minBudget: intent.minBudget,
    cuisines: intent.cuisines,
    // 成员独立位置（可选）：{ lat, lng, address }
    memberLocation,
  };
}

const ALLERGY_TRAIT_MAP = {
  '辣': { trait: 'spicy', type: 'soft', penalty: 15 },
  '麻辣': { trait: 'spicy', type: 'soft', penalty: 15 },
  '香菜': { trait: 'cilantro', type: 'soft', penalty: 12 },
  '素食': { conflictTrait: 'meat', friendlyTrait: 'vegetarian_friendly', type: 'soft_strong', penalty: 25 },
  '清真': { trait: 'halal', type: 'hard' },
  '海鲜': { trait: 'seafood', type: 'hard' },
  '坚果': { trait: 'nuts', type: 'hard' },
  '花生': { trait: 'peanuts', type: 'hard' },
  '牛奶': { trait: 'dairy', type: 'hard' },
  '乳糖不耐': { trait: 'dairy', type: 'hard' },
  '减肥': { conflictTrait: 'heavy', friendlyTrait: 'light', type: 'soft', penalty: 10 },
  '低卡': { conflictTrait: 'heavy', friendlyTrait: 'light', type: 'soft', penalty: 10 },
};

function detectConflicts(members) {
  // 确保每个成员有 _memberId，用于全链路去重（避免重名）
  members.forEach((m, i) => { if (!m._memberId) m._memberId = `m${i}`; });


  const conflicts = [];

  const isCuisineKeyword = (word) => {
    return Object.keys(CUISINE_TRAITS).some(k => k.includes(word) || word.includes(k));
  };

  const getCuisineTraits = (pref) => {
    const traits = new Set();
    for (const [cuisine, cTraits] of Object.entries(CUISINE_TRAITS)) {
      if (cuisine.includes(pref) || pref.includes(cuisine)) {
        cTraits.forEach(t => traits.add(t));
      }
    }
    return traits;
  };

  members.forEach(memberA => {
    if (!memberA.preferences || memberA.preferences.length === 0) return;

    memberA.preferences.forEach(pref => {
      if (!isCuisineKeyword(pref)) return;
      const prefTraits = getCuisineTraits(pref);
      if (prefTraits.size === 0) return;

      members.forEach(memberB => {
        if (memberB === memberA || !memberB.allergies) return;

        memberB.allergies.forEach(allergy => {
          const allergyInfo = ALLERGY_TRAIT_MAP[allergy];
          if (!allergyInfo) return;

          let isConflict = false;
          let resolution = '';
          let altKeyword = '';

          if (allergyInfo.type === 'hard') {
            if (allergyInfo.conflictTrait && prefTraits.has(allergyInfo.conflictTrait)) {
              isConflict = true;
              resolution = `${allergy}不能吃${pref}，已排除`;
            }
            if (allergyInfo.trait && prefTraits.has(allergyInfo.trait)) {
              isConflict = true;
              resolution = `${allergy}不能吃${pref}，已排除`;
            }
          } else if (allergyInfo.type === 'soft_strong') {
            if (allergyInfo.conflictTrait && prefTraits.has(allergyInfo.conflictTrait)) {
              isConflict = true;
              resolution = `${pref}以肉食为主，但通常有素菜可选，已优先推荐素友好的店`;
              altKeyword = `素${pref}`;
            }
          } else if (allergyInfo.type === 'soft') {
            if (allergyInfo.trait && prefTraits.has(allergyInfo.trait)) {
              isConflict = true;
              if (allergy === '辣') {
                resolution = `推荐不辣或少辣的${pref}`;
                altKeyword = `不辣${pref}`;
              } else if (allergy === '香菜') {
                resolution = `${pref}可能含香菜，可要求不加`;
              } else {
                resolution = `${pref}可能不符合${allergy}的需求，可调整`;
              }
            }
            if (allergyInfo.conflictTrait && prefTraits.has(allergyInfo.conflictTrait)) {
              isConflict = true;
              if (allergy === '减肥' || allergy === '低卡') {
                resolution = `${pref}偏高热量，注意控制`;
                altKeyword = `轻食${pref}`;
              }
            }
          }

          if (isConflict && !conflicts.some(c =>
            c.preference === pref && c.allergy === allergy &&
            c._memberIdA === memberA._memberId && c._memberIdB === memberB._memberId
          )) {
            conflicts.push({
              preference: pref,
              allergy,
              type: allergyInfo.type,
              resolution,
              altKeyword,
              _memberIdA: memberA._memberId,
              _memberIdB: memberB._memberId,
              members: [memberA.name, memberB.name],
              prefMemberName: memberA.name,  // 提偏好的这个人（soft偏好可以妥协）
              memberName: memberB.name,       // 提忌口的这个人（硬约束优先级高）
            });
          }
        });
      });
    });
  });

  return conflicts;
}

export function mergeMemberIntents(members) {
  const validMembers = members.filter(m => m && m.text && m.text.trim());

  if (validMembers.length === 0) {
    return {
      location: '',
      peopleCount: 1,
      preferences: [],
      allergies: [],
      budget: null,
      atmosphere: '',
      shopType: '',
      cuisineVote: {
        votes: {},
        topCuisine: null,
        topCount: 0,
        consensusLevel: 'none',
        tieCuisines: null,
        memberCount: 0,
      },
      members: [],
    };
  }

  const allPreferences = new Set();
  const allAllergies = new Set();
  let groupMaxBudget = null;
  let groupMinBudget = null;
  const atmosphereCounts = { 安静: 0, 热闹: 0 };

  validMembers.forEach(member => {
    member.preferences.forEach(p => allPreferences.add(p));
    member.allergies.forEach(a => allAllergies.add(a));
    if (member.atmosphere) {
      atmosphereCounts[member.atmosphere] = (atmosphereCounts[member.atmosphere] || 0) + 1;
    }
  });

  // ===== 多人预算交集计算 =====
  // 每个成员的预算区间 [min, max]
  // - "80以内" → [0, 80]
  // - "100左右" → [70, 130]
  // - "100以上" → [100, 200]（占位上限）
  // - 没提 → 跳过，不参与约束
  const memberBudgetRanges = [];
  validMembers.forEach(member => {
    const min = member.minBudget || 0;
    let max = member.budget;
    // "以上"产生的占位符（budget=null）→ 用 minBudget*2 作为合理上限
    if (max === null && member.minBudget) {
      max = member.minBudget * 2;
    }
    if (max !== null) {
      memberBudgetRanges.push({ name: member.name, min, max });
    } else if (member.minBudget) {
      // 只有下限没有上限
      memberBudgetRanges.push({ name: member.name, min, max: null });
    }
  });

  let budgetCompromise = null;

  if (memberBudgetRanges.length === 1) {
    // 单人有预算 → 直接用
    groupMinBudget = memberBudgetRanges[0].min;
    groupMaxBudget = memberBudgetRanges[0].max === null ? null : memberBudgetRanges[0].max;
  } else if (memberBudgetRanges.length >= 2) {
    // 多人有预算 → 计算交集 [max(allMins), min(allMaxs)]
    const allMins = memberBudgetRanges.map(r => r.min);
    const allMaxs = memberBudgetRanges.map(r => r.max);
    const interMin = Math.max(...allMins);
    const interMax = Math.min(...allMaxs);

    if (interMin <= interMax && interMax !== null) {
      // 交集非空 → 用交集
      groupMinBudget = interMin;
      groupMaxBudget = interMax;
      // 交集太窄（<15元）→ 适当放宽到中点±15
      if (interMax - interMin < 15) {
        const mid = Math.round((interMin + interMax) / 2);
        groupMinBudget = Math.max(0, mid - 15);
        groupMaxBudget = mid + 15;
        budgetCompromise = {
          type: 'narrow_intersection',
          text: `大家预算交集较窄（${interMin}-${interMax}元），已适当放宽到${groupMinBudget}-${groupMaxBudget}元`,
          range: [groupMinBudget, groupMaxBudget],
        };
      } else {
        budgetCompromise = {
          type: 'intersection',
          text: `大家预算交集为${interMin}-${interMax}元，在此范围内推荐`,
          range: [interMin, interMax],
        };
      }
    } else {
      // 交集为空（A说50-80, B说100-150）→ 回退到中位数价格±30%
      const midpoints = memberBudgetRanges.map(r => Math.round((r.min + r.max) / 2));
      const sortedMid = [...midpoints].sort((a, b) => a - b);
      const medianMid = sortedMid[Math.floor(sortedMid.length / 2)];
      groupMinBudget = Math.max(0, Math.round(medianMid * 0.7));
      groupMaxBudget = Math.round(medianMid * 1.3);

      // 生成折中说明
      const rangeTexts = memberBudgetRanges.map(r =>
        r.max === null ? `${r.name}:${r.min}元以上` : `${r.name}:${r.min}-${r.max}元`
      );
      budgetCompromise = {
        type: 'empty_intersection',
        text: `${rangeTexts.join('、')}无交集，已按中位数${medianMid}元折中推荐（${groupMinBudget}-${groupMaxBudget}元）`,
        median: medianMid,
        range: [groupMinBudget, groupMaxBudget],
        memberRanges: memberBudgetRanges,
      };
    }
  }

  // 共同偏好：所有成员都提到的偏好
  const commonPreferences = validMembers.length > 0
    ? validMembers[0].preferences.filter(p =>
        validMembers.every(m => m.preferences.includes(p))
      )
    : [];

  // 全体忌口合并（一票否决）
  const groupAllergies = Array.from(allAllergies);

  // 群体氛围：取多数票
  let groupAtmosphere = '';
  if (atmosphereCounts.安静 > atmosphereCounts.热闹) {
    groupAtmosphere = '安静';
  } else if (atmosphereCounts.热闹 > atmosphereCounts.安静) {
    groupAtmosphere = '热闹';
  }

  // 店铺类型：从成员偏好中提取
  const cuisineTypes = ['火锅', '烧烤', '快餐', '甜品', '川菜', '江浙菜', '粤菜', '日料', '韩餐', '西餐'];
  let shopType = '';
  for (const cuisine of cuisineTypes) {
    if (allPreferences.has(cuisine)) {
      shopType = cuisine;
      break;
    }
  }

  // 菜系投票统计
  const cuisineVotes = {};
  validMembers.forEach(member => {
    if (member.cuisines && member.cuisines.length > 0) {
      member.cuisines.forEach(cuisine => {
        cuisineVotes[cuisine] = (cuisineVotes[cuisine] || 0) + 1;
      });
    }
  });

  const calculateCuisineResult = (votes, memberCount) => {
    const sortedCuisines = Object.entries(votes).sort((a, b) => b[1] - a[1]);

    if (sortedCuisines.length === 0) {
      return {
        votes: {},
        topCuisine: null,
        topCount: 0,
        consensusLevel: 'none',
        tieCuisines: null,
        memberCount,
      };
    }

    const topCount = sortedCuisines[0][1];
    const topCuisine = sortedCuisines[0][0];

    const tieCuisines = sortedCuisines.filter(([, count]) => count === topCount).map(([cuisine]) => cuisine);

    let consensusLevel;
    if (topCount >= memberCount * 0.6) {
      consensusLevel = 'strong';
    } else if (sortedCuisines.length >= 2 && sortedCuisines[0][1] === sortedCuisines[1][1] && sortedCuisines[0][1] >= 2) {
      const thirdCount = sortedCuisines.length > 2 ? sortedCuisines[2][1] : 0;
      if (sortedCuisines[0][1] > thirdCount) {
        consensusLevel = 'split';
      } else {
        consensusLevel = 'diverse';
      }
    } else if (sortedCuisines.length >= 3 && topCount < memberCount * 0.5) {
      consensusLevel = 'diverse';
    } else {
      consensusLevel = 'diverse';
    }

    return {
      votes: { ...votes },
      topCuisine: tieCuisines.length === 1 ? topCuisine : null,
      topCount,
      consensusLevel,
      tieCuisines: tieCuisines.length > 1 ? tieCuisines : null,
      memberCount,
    };
  };

  const initialCuisineResult = calculateCuisineResult(cuisineVotes, validMembers.length);

  const forbiddenCuisines = new Set();
  validMembers.forEach(member => {
    if (member.allergies) {
      member.allergies.forEach(allergy => {
        const allergyInfo = ALLERGY_TRAIT_MAP[allergy];
        if (allergyInfo && allergyInfo.type === 'hard' && ALLERGY_CUISINE_MAP[allergy]) {
          ALLERGY_CUISINE_MAP[allergy].forEach(cuisine => {
            forbiddenCuisines.add(cuisine);
          });
        }
      });
    }
  });

  const filteredVotes = {};
  Object.entries(cuisineVotes).forEach(([cuisine, count]) => {
    if (!forbiddenCuisines.has(cuisine)) {
      filteredVotes[cuisine] = count;
    }
  });

  const cuisineVote = calculateCuisineResult(filteredVotes, validMembers.length);

  // 检测偏好与忌口的冲突
  const conflicts = detectConflicts(validMembers);

  // 提取软冲突的替代关键词，用于搜索
  const conflictAltKeywords = conflicts
    .filter(c => (c.type === 'soft' || c.type === 'soft_strong') && c.altKeyword)
    .map(c => c.altKeyword);

  return {
    location: '',
    peopleCount: validMembers.length,
    preferences: Array.from(allPreferences),
    commonPreferences,
    allergies: groupAllergies,
    budget: groupMaxBudget,
    minBudget: groupMinBudget,
    budgetCompromise,
    atmosphere: groupAtmosphere,
    shopType,
    cuisineVote,
    conflicts,
    conflictAltKeywords,
    members: validMembers,
  };
}

/**
 * LLM 增强版合并成员意图
 * LLM 输出的 searchKeywords 直接作为偏好标签传给规则引擎合并
 * LLM 不可用时自动回退到纯规则
 */
export async function mergeMemberIntentsWithLLM(members) {
  if (!isLLMAvailable()) {
    // LLM 不可用时先规则解析，保留 memberLocation
    const parsed = members.map(m => {
      const memberLocation = (m.lat && m.lng) ? { lat: m.lat, lng: m.lng, address: m.address } : null;
      return parseMemberIntent(m.text, m.name, memberLocation);
    });
    return mergeMemberIntents(parsed);
  }

  const validMembers = members.filter(m => m && m.text && m.text.trim());
  if (validMembers.length === 0) {
    const parsed = members.map(m => {
      const memberLocation = (m.lat && m.lng) ? { lat: m.lat, lng: m.lng, address: m.address } : null;
      return parseMemberIntent(m.text, m.name, memberLocation);
    });
    return mergeMemberIntents(parsed);
  }

  const enrichedMembers = await Promise.all(
    validMembers.map(async (m) => {
      const memberLocation = (m.lat && m.lng) ? { lat: m.lat, lng: m.lng, address: m.address } : null;
      const ruleResult = parseMemberIntent(m.text, m.name, memberLocation);
      const llmResult = await parseWithLLM(m.text);
      if (llmResult && llmResult.searchKeywords.length > 0) {
        // Split: known cuisines -> preferences (scoring+display), rest -> searchKeywords only
        const llmPrefs = llmResult.searchKeywords.filter(k => KNOWN_CUISINE.has(k));
        return {
          name: m.name, text: m.text,
          preferences: [...new Set([...llmPrefs, ...ruleResult.preferences])],
          searchKeywords: llmResult.searchKeywords,
          intent: llmResult.intent || '',
          allergies: [...new Set([...(llmResult.allergies || []), ...ruleResult.allergies])],
          budget: llmResult.budget || ruleResult.budget || null,
          minBudget: llmResult.minBudget || ruleResult.minBudget || null,
          atmosphere: llmResult.atmosphere || ruleResult.atmosphere || '',
          cuisines: [...new Set([...llmPrefs, ...ruleResult.cuisines])],
          memberLocation,
        };
      }
      return ruleResult;
    })
  );

  return mergeMemberIntents(enrichedMembers);
}

/**
 * LLM 增强版单人意图解析
 * LLM 不可用时返回 null，调用方回退到规则引擎
 */
export async function parseSoloIntentWithLLM(text) {
  if (!isLLMAvailable() || !text || !text.trim()) return null;
  const llmResult = await parseWithLLM(text);
  if (!llmResult || llmResult.searchKeywords.length === 0) return null;
  const llmPrefs = llmResult.searchKeywords.filter(k => KNOWN_CUISINE.has(k));
  return {
    preferences: llmPrefs,
    searchKeywords: llmResult.searchKeywords,
    intent: llmResult.intent || '',
    allergies: llmResult.allergies || [],
    budget: llmResult.budget || null,
    minBudget: llmResult.minBudget || null,
    atmosphere: llmResult.atmosphere || '',
  };
}

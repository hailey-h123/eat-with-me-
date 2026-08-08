import { parseWithLLM, isLLMAvailable } from './llmClient';

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

const CUISINE_KEYWORDS = {
  '火锅': ['火锅', '涮锅', '串串', '麻辣烫', '冒菜', '铜锅', '鸳鸯锅', '打边炉'],
  '烤肉': ['烤肉', '韩式烤肉', '日式烤肉', '烧肉', '韩国烤肉'],
  '烧烤': ['烧烤', '烤串', '撸串', '羊肉串', '烤鱼', '烤生蚝'],
  '日料': ['日料', '寿司', '刺身', '拉面', '日式', '日本料理', '居酒屋', '定食', '丼饭'],
  '韩餐': ['韩餐', '韩国料理', '韩式', '部队锅', '石锅拌饭', '炸鸡', '辣白菜', '冷面'],
  '川菜': ['川菜', '川', '麻辣', '四川', '重庆', '水煮鱼', '回锅肉', '宫保鸡丁'],
  '湘菜': ['湘菜', '湘', '湖南', '剁椒鱼头', '小炒肉'],
  '粤菜': ['粤菜', '粤', '广东', '广式', '潮汕', '早茶', '点心', '烧腊', '叉烧'],
  '江浙菜': ['江浙菜', '杭帮菜', '上海菜', '本帮菜', '江浙', '江南', '苏杭', '淮扬菜', '无锡菜', '宁波菜'],
  '东北菜': ['东北菜', '东北', '东北菜', '酸菜', '锅包肉', '小鸡炖蘑菇', '杀猪菜', '乱炖', '大拉皮', '地三鲜'],
  '西北菜': ['西北菜', '陕西', '西安', '兰州', '牛肉面', '羊肉泡馍', '肉夹馍', '凉皮', '大盘鸡', '烤馕'],
  '云南菜': ['云南菜', '滇菜', '云南', '过桥米线', '汽锅鸡', '宣威火腿'],
  '贵州菜': ['贵州菜', '黔菜', '贵州', '酸汤鱼', '丝娃娃', '老干妈', '折耳根'],
  '北京菜': ['北京菜', '京菜', '北京', '烤鸭', '炸酱面', '卤煮', '涮羊肉'],
  '鲁菜': ['鲁菜', '山东菜', '山东', '孔府菜', '九转大肠', '葱烧海参'],
  '江西菜': ['江西菜', '赣菜', '江西', '南昌炒粉', '瓦罐汤'],
  '福建菜': ['福建菜', '闽菜', '福建', '福州菜', '佛跳墙', '沙茶面', '厦门'],
  '广西菜': ['广西菜', '桂菜', '广西', '螺蛳粉', '桂林米粉', '酸嘢'],
  '新疆菜': ['新疆菜', '新疆', '大盘鸡', '烤包子', '手抓饭', '羊肉串'],
  '西餐': ['西餐', '西式', '牛排', '意面', '披萨', '沙拉', '意式', '法式', '美式'],
  '意面': ['意面', '意大利面', 'pasta', '通心粉'],
  '披萨': ['披萨', '比萨', 'pizza'],
  '东南亚菜': ['东南亚菜', '泰国菜', '越南菜', '新加坡', '马来西亚', '冬阴功'],
  '泰菜': ['泰菜', '泰国', '冬阴功', '咖喱', '青木瓜沙拉'],
  '越南菜': ['越南菜', '越南', '河粉', '春卷', '法棍'],
  '面馆': ['面馆', '面', '米线', '粉', '拉面', '嗦面', '拌面', '汤面'],
  '饺子': ['饺子', '水饺', '煎饺', '蒸饺', '锅贴'],
  '包子': ['包子', '小笼包', '汤包', '叉烧包'],
  '粥': ['粥', '稀饭', '粥铺', '砂锅粥', '海鲜粥'],
  '汤': ['汤', '炖汤', '煲汤', '老火汤', '靓汤'],
  '快餐': ['快餐', '汉堡', '炸鸡', '麦当劳', '肯德基', '便当', '盒饭'],
  '轻食': ['轻食', '沙拉', '健康餐', '低卡', '素食'],
  '海鲜': ['海鲜', '鱼', '虾', '蟹', '贝类', '刺身'],
  '自助': ['自助', '自助餐', 'all you can eat'],
  '甜品': ['甜品', '蛋糕', '点心', '奶茶', '咖啡', '冰淇淋'],
  '咖啡': ['咖啡', '拿铁', '美式', '手冲', 'Espresso'],
  '烧腊': ['烧腊', '叉烧', '烧鹅', '烤鸭', '卤味'],
  '卤味': ['卤味', '卤肉', '卤菜', '卤水'],
};

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
    result.budget = 999; // 无上限，设一个高值兜底
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
        if (m) { const v = parseInt(m[1] || m[2]); if (v) { result.minBudget = v; result.budget = 999; break; } }
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
export function parseMemberIntent(text, name = '成员') {
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
  };
}

/**
 * 合并多个成员的意图为一个群体意图
 * @param {Array} members - 成员意图列表
 * @returns {Object} 群体意图
 */
const CUISINE_TRAITS = {
  '川菜': ['spicy', 'heavy'],
  '湘菜': ['spicy', 'heavy'],
  '重庆': ['spicy', 'heavy'],
  '麻辣': ['spicy'],
  '火锅': ['spicy', 'group', 'hot'],
  '串串': ['spicy', 'group'],
  '冒菜': ['spicy'],
  '麻辣烫': ['spicy'],
  '烤肉': ['meat', 'group', 'grill'],
  '烧烤': ['meat', 'group', 'grill'],
  '烤串': ['meat', 'grill'],
  '日料': ['seafood', 'light', 'quiet'],
  '寿司': ['seafood', 'light'],
  '刺身': ['seafood'],
  '日式': ['seafood', 'light'],
  '日本料理': ['seafood', 'light'],
  '海鲜': ['seafood'],
  '鱼': ['seafood'],
  '虾': ['seafood'],
  '蟹': ['seafood'],
  '韩餐': ['spicy', 'meat'],
  '韩式烤肉': ['meat', 'spicy'],
  '部队锅': ['spicy', 'group'],
  '炸鸡': ['meat', 'fried'],
  '江浙菜': ['light', 'sweet'],
  '杭帮菜': ['light', 'sweet'],
  '上海菜': ['light', 'sweet'],
  '淮扬菜': ['light', 'sweet'],
  '粤菜': ['light', 'seafood'],
  '广式': ['light'],
  '潮汕': ['light', 'seafood'],
  '西餐': ['meat', 'quiet'],
  '牛排': ['meat', 'quiet'],
  '意面': ['light'],
  '披萨': ['heavy', 'group'],
  '东南亚菜': ['spicy', 'exotic'],
  '泰国菜': ['spicy', 'exotic'],
  '泰菜': ['spicy', 'exotic'],
  '越南菜': ['light', 'exotic'],
  '面馆': ['fast', 'noodles'],
  '米线': ['fast', 'noodles'],
  '拉面': ['fast', 'noodles'],
  '粉': ['fast', 'noodles'],
  '快餐': ['fast', 'cheap'],
  '汉堡': ['fast', 'meat'],
  '轻食': ['vegetarian_friendly', 'healthy', 'light'],
  '沙拉': ['vegetarian_friendly', 'healthy'],
  '素食': ['vegetarian'],
  '甜品': ['sweet', 'casual'],
  '蛋糕': ['sweet', 'casual'],
  '奶茶': ['sweet', 'drink'],
  '咖啡': ['drink', 'quiet'],
  '自助': ['group', 'all_you_can_eat'],
  '粥': ['light', 'warm'],
  '汤': ['light', 'warm'],
  '砂锅': ['warm', 'group'],
  '小吃': ['fast', 'casual', 'street'],
  '撸串': ['meat', 'grill', 'street'],
  '云南菜': ['spicy', 'exotic'],
  '北京菜': ['meat'],
  '东北菜': ['heavy', 'meat', 'group'],
  '西北菜': ['heavy', 'meat', 'group'],
  '贵州菜': ['spicy', 'exotic'],
  '鲁菜': ['heavy', 'meat'],
  '江西菜': ['spicy', 'heavy'],
  '福建菜': ['light', 'seafood'],
  '广西菜': ['spicy', 'exotic'],
  '新疆菜': ['heavy', 'meat', 'group'],
  '饺子': ['group', 'casual'],
  '包子': ['fast', 'casual'],
  '烧腊': ['meat'],
  '卤味': ['meat', 'casual'],
};

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
            c.members[0] === memberA.name && c.members[1] === memberB.name
          )) {
            conflicts.push({
              preference: pref,
              allergy,
              type: allergyInfo.type,
              resolution,
              altKeyword,
              members: [memberA.name, memberB.name],
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
    // maxBudget：取所有成员中最严格的上限（跳过"以上"产生的高值占位符）
    if (member.budget) {
      // 如果 budget === 999 且成员有明确的 minBudget，说明这是"以上"产生的占位符
      const isSentinel = member.budget >= 900 && member.minBudget;
      if (!isSentinel) {
        if (groupMaxBudget === null || member.budget < groupMaxBudget) {
          groupMaxBudget = member.budget;
        }
      }
    }
    // minBudget：取所有成员中最严格的下限（至少要花这么多）
    if (member.minBudget) {
      if (groupMinBudget === null || member.minBudget > groupMinBudget) {
        groupMinBudget = member.minBudget;
      }
    }
    if (member.atmosphere) {
      atmosphereCounts[member.atmosphere] = (atmosphereCounts[member.atmosphere] || 0) + 1;
    }
  });

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
  if (!isLLMAvailable()) return mergeMemberIntents(members);

  const validMembers = members.filter(m => m && m.text && m.text.trim());
  if (validMembers.length === 0) return mergeMemberIntents(members);

  const enrichedMembers = await Promise.all(
    validMembers.map(async (m) => {
      const ruleResult = parseMemberIntent(m.text, m.name);
      const llmResult = await parseWithLLM(m.text);
      if (llmResult && llmResult.searchKeywords.length > 0) {
        return {
          name: m.name, text: m.text,
          preferences: [...new Set([...llmResult.searchKeywords, ...ruleResult.preferences])],
          allergies: [...new Set([...(llmResult.allergies || []), ...ruleResult.allergies])],
          budget: llmResult.budget || ruleResult.budget || null,
          minBudget: llmResult.minBudget || ruleResult.minBudget || null,
          atmosphere: llmResult.atmosphere || ruleResult.atmosphere || '',
          cuisines: [...new Set([...llmResult.searchKeywords, ...ruleResult.cuisines])],
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
  return {
    preferences: llmResult.searchKeywords,
    allergies: llmResult.allergies || [],
    budget: llmResult.budget || null,
    minBudget: llmResult.minBudget || null,
    atmosphere: llmResult.atmosphere || '',
  };
}

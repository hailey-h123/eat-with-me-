import { mockRestaurants } from '../data/mockRestaurants';

// 优先读取环境变量，其次读取 public/config.js 中的默认配置
// 🔧 校验 key 格式：高德 API Key 是 32 位 hex 字符串，防止占位符被当真实 key 使用
const HEX32 = /^[a-f0-9]{32}$/i;
function validKey(v) { return typeof v === 'string' && HEX32.test(v); }

const appConfig = window.APP_CONFIG || {};
const _envWeb = import.meta.env.VITE_AMAP_WEB_KEY || '';
const _envJs = import.meta.env.VITE_AMAP_KEY || '';
const WEB_KEY = validKey(_envWeb) ? _envWeb : (appConfig.AMAP_WEB_KEY || '');
const JS_KEY = validKey(_envJs) ? _envJs : (appConfig.AMAP_KEY || '');
export const IS_MOCK_MODE = !WEB_KEY;

let jsonpCounter = 0;

// 补齐 mock 餐厅的 featureTags：features 数组中不是菜系/大类描述的才作为特色标签展示
// mockRestaurants 里 features = ['不辣','轻食可选','有饮品']，应该直接展示成特色 pill
function ensureMockRestaurantFeatureTags(r) {
  const featureTags = (r.featureTags && r.featureTags.length > 0)
    ? r.featureTags
    : (r.features || []).filter(f => f && f.length <= 8).slice(0, 4); // 过滤过长的描述文字
  return {
    ...r,
    featureTags,
    // features 保留，用于评分融合/匹配
    features: r.features || featureTags,
    tags: r.tags || [],
  };
}

// Mock 搜索：在没有 API Key 时使用
function mockSearch(keyword, location, radius = 3000) {
  // 按 | 分割关键词，任一匹配即命中（与高德 API 的 OR 语义一致）
  const keywords = keyword.toLowerCase().split('|').map(k => k.trim()).filter(Boolean);
  const results = mockRestaurants.filter(r => {
    const name = r.name.toLowerCase();
    const cuisine = (r.cuisine || '').toLowerCase();
    const tags = (r.tags || []).map(t => t.toLowerCase());
    const features = (r.features || []).map(f => f.toLowerCase());
    return keywords.some(kw =>
      name.includes(kw) ||
      cuisine.includes(kw) ||
      tags.some(t => t.includes(kw)) ||
      features.some(f => f.includes(kw))
    );
  });
  
  // 根据距离过滤
  if (results.length === 0) {
    // 如果没有匹配，返回所有餐厅
    return mockRestaurants.map(r => ensureMockRestaurantFeatureTags({
      ...r,
      distance: Math.floor(Math.random() * 80) + 5,
      distanceMeters: Math.floor(Math.random() * 5000) + 500,
      lng: location?.lng || 116.4706,
      lat: location?.lat || 39.9997,
    }));
  }
  
  return results.map(r => ensureMockRestaurantFeatureTags({
    ...r,
    distance: Math.floor(Math.random() * 40) + 2,
    distanceMeters: Math.floor(Math.random() * 3000) + 200,
    lng: location?.lng || 116.4706,
    lat: location?.lat || 39.9997,
  }));
}

// Mock 地理编码：根据地址文本生成稳定但有差异的坐标（避免与默认坐标完全相同）
// 确保用户无论填什么位置，坐标都会和默认位置有区分，搜索也会得到相对应的 mock 距离
function mockGeocode(address) {
  const name = (address || 'Mock Location').trim() || 'Mock Location';
  // 用地址内容做简单的字符串哈希，得到稳定偏移（同一地址始终返回相同坐标）
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  const baseLng = 116.4706;
  const baseLat = 39.9997;
  const offsetLng = ((hash % 1000) / 1000 - 0.5) * 0.06;    // ±0.03° ≈ ±3.3km
  const offsetLat = (((hash / 1000) | 0) % 1000) / 1000;
  const offsetLatN = (offsetLat - 0.5) * 0.05;               // ±0.025° ≈ ±2.8km
  return {
    lng: +(baseLng + offsetLng).toFixed(6),
    lat: +(baseLat + offsetLatN).toFixed(6),
    name,
  };
}

function jsonp(url, params) {
  return new Promise((resolve, reject) => {
    const callbackName = `amap_jsonp_${Date.now()}_${jsonpCounter++}`;
    const allParams = new URLSearchParams(params);
    allParams.append('callback', callbackName);

    const script = document.createElement('script');
    script.src = `${url}?${allParams.toString()}`;

    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('请求超时'));
    }, 10000);

    const cleanup = () => {
      clearTimeout(timer);
      delete window[callbackName];
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };

    window[callbackName] = (data) => {
      cleanup();
      // 🔧 修复：高德 status !== '1' 都视为错误，不做静默吞掉
      // infocode 参考：10021=QPS超限（可重试）；10003=域名不对；10004=key无效；其他=参数/服务错误
      if (data.status !== '1') {
        const infocode = data.infocode || 'UNKNOWN';
        const info = data.info || 'API返回错误';
        const err = new Error(`${info} (infocode=${infocode})`);
        err.infocode = infocode;
        err.info = info;
        err.data = data;
        reject(err);
        return;
      }
      resolve(data);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error('网络请求失败'));
    };

    document.head.appendChild(script);
  });
}

// 指数退避延迟
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 高德 API 调用包装器：10021 (QPS超限) 自动重试最多3次；其他错误直接抛
async function callAmapWithRetry(url, params, maxRetries = 3) {
  let lastError = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await jsonp(url, params);
    } catch (err) {
      lastError = err;
      if (err.infocode === '10021') {
        // QPS超限：指数退避 200ms → 400ms → 800ms
        const delay = 200 * Math.pow(2, attempt);
        console.warn(`[amapService] QPS超限(10021)，${delay}ms后重试(${attempt + 1}/${maxRetries})`);
        await sleep(delay);
        continue;
      }
      // 非限流错误，直接抛
      throw err;
    }
  }
  // 重试完仍失败
  throw lastError;
}

export async function searchPOI(keyword, location, radius = 3000, minRadius = 0, maxRadius = 0, pageNum = 1, pageSize = 25) {
  // Mock 模式：没有 API Key 时使用本地数据
  if (!WEB_KEY) {
    return mockSearch(keyword, location, radius);
  }

  try {
    const data = await callAmapWithRetry('https://restapi.amap.com/v5/place/around', {
      key: WEB_KEY,
      keywords: keyword,
      location: `${location.lng},${location.lat}`,
      radius: radius.toString(),
      page_size: pageSize.toString(),
      page_num: pageNum.toString(),
      show_fields: 'business,photos',
    });

    if (data.pois) {
      let results = data.pois.map(poi => convertPOIToRestaurant(poi));
      if (minRadius > 0) {
        results = results.filter(r => r.distanceMeters >= minRadius);
      }
      if (maxRadius > 0) {
        results = results.filter(r => r.distanceMeters <= maxRadius);
      }
      return results;
    }
    return [];
  } catch (error) {
    console.error('[amapService] POI 搜索失败:', error);
    return null;
  }
}

export async function searchPOIByDistanceRanges(keyword, location, ranges) {
  const allResults = [];
  const seenIds = new Set();

  for (const { min, max } of ranges) {
    const results = await searchPOI(keyword, location, max, min, max);
    if (results) {
      results.forEach(r => {
        if (!seenIds.has(r.id)) {
          seenIds.add(r.id);
          allResults.push(r);
        }
      });
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  return allResults;
}

export async function geocode(address) {
  // 按优先级尝试所有可用 Key：WEB_KEY → JS_KEY → mock
  const keys = [...new Set([WEB_KEY, JS_KEY].filter(Boolean))];
  let lastErr = null;

  // 🔧 修复1：优先用 POI text 搜索（对简称/地标名支持比地理编码 API 好得多）
  // 真实测试：'中关村' → 地理编码API命中宁夏中卫的村庄，POI搜索命中北京中关村
  for (const key of keys) {
    try {
      const data = await callAmapWithRetry('https://restapi.amap.com/v3/place/text', {
        key,
        keywords: address,
        page_size: '3',
      });

      if (data.pois && data.pois.length > 0) {
        const poi = data.pois[0];
        if (poi.location) {
          const [lng, lat] = poi.location.split(',');
          return {
            lng: parseFloat(lng),
            lat: parseFloat(lat),
            name: poi.name || address,
          };
        }
      }
    } catch (error) {
      lastErr = error;
      // 当前 key 失败，尝试下一个
    }
  }

  // 🔧 修复2：POI 搜索无结果时，再尝试地理编码 API
  for (const key of keys) {
    try {
      const data = await callAmapWithRetry('https://restapi.amap.com/v3/geocode/geo', {
        key,
        address,
      });

      if (data.geocodes && data.geocodes.length > 0) {
        // 过滤掉 level='村庄' 的误匹配（典型的就是三里屯匹配到宁夏的村庄）
        const validGeocodes = data.geocodes.filter(g => g.level !== '村庄' && g.level !== '兴趣点');
        const pick = validGeocodes.length > 0 ? validGeocodes[0] : data.geocodes[0];
        const location = pick.location.split(',');
        return {
          lng: parseFloat(location[0]),
          lat: parseFloat(location[1]),
          name: pick.formatted_address || address,
        };
      }
    } catch (error) {
      lastErr = error;
      // 当前 key 失败，尝试下一个
    }
  }

  // 3. 所有 Key 都失败时，mock 模式兜底
  if (IS_MOCK_MODE || keys.length === 0) {
    return mockGeocode(address);
  }

  // 🔧 修复3：错误分类透出给上层
  console.error('[amapService] 地理编码失败:', lastErr);
  const err = new Error(lastErr?.message || '无法获取该位置的坐标');
  err.infocode = lastErr?.infocode;
  err.cause = lastErr;
  // 10021/QPS超限不抛硬错，返回 mock 结果让用户继续用（兜底用原位置）
  if (lastErr?.infocode === '10021') {
    const fallback = mockGeocode(address);
    fallback._throttled = true;
    return fallback;
  }
  throw err;
}

export async function regeocode(lng, lat) {
  // Mock 模式
  if (!WEB_KEY) {
    return '北京市朝阳区望京SOHO';
  }

  try {
    const data = await callAmapWithRetry('https://restapi.amap.com/v3/geocode/regeo', {
      key: WEB_KEY,
      location: `${lng},${lat}`,
    });

    if (data.regeocode) {
      return data.regeocode.formatted_address;
    }
    return null;
  } catch (error) {
    console.error('逆地理编码失败:', error);
    return null;
  }
}

// 低质量图片标题关键词（菜单、价目表、小票等）
const BAD_PHOTO_KEYWORDS = ['菜单', '价目', '价格', '小票', '收据', '账单', '结账', '发票', '二维码', '名片'];

// 环境图标题关键词（商家上传，质量普遍较高）
const ENVIRONMENT_KEYWORDS = ['环境', '门面', '店内', '装修', '大厅', '外观', '招牌', '门头', '入口', '外景', '包间', '座位', '前台', '内景', '店面', '门店', '全景', '室内', '室外', '走廊', '阳台', '露台', '庭院'];

// 菜品图标题关键词
const DISH_KEYWORDS = ['菜品', '招牌菜', '美食', '推荐菜', '特色菜', '套餐', '招牌', '人气', '单品', '料理', '拼盘', '实物', '主厨', '热销'];

// 按优先级对图片排序：环境图 → 菜品图 → 其他图；过滤掉菜单/小票等低质量图
function sortPhotosByQuality(photos) {
  if (!photos || photos.length === 0) return [];

  // 过滤掉低质量图片
  const filtered = photos.filter(p => {
    const title = (p.title || '').toLowerCase();
    return !BAD_PHOTO_KEYWORDS.some(kw => title.includes(kw));
  });

  // 如果过滤后为空，保留原图（避免完全没图）
  const pool = filtered.length > 0 ? filtered : photos;

  // 分类：环境图、菜品图、其他图
  const envPhotos = [];
  const dishPhotos = [];
  const otherPhotos = [];

  pool.forEach(p => {
    const title = (p.title || '').toLowerCase();
    if (ENVIRONMENT_KEYWORDS.some(kw => title.includes(kw))) {
      envPhotos.push(p);
    } else if (DISH_KEYWORDS.some(kw => title.includes(kw))) {
      dishPhotos.push(p);
    } else {
      otherPhotos.push(p);
    }
  });

  // 如果菜品图为空，尝试从 other 中二次匹配（用更宽泛的关键词捞一些）
  if (dishPhotos.length === 0 && otherPhotos.length > 0) {
    const BROAD_DISH = ['食', '餐', '饭', '面', '锅', '肉', '鱼', '虾', '蟹', '鸡', '鸭', '牛', '羊', '猪', '汤', '煲', '烤', '炸', '炒', '蒸', '煮', '烧', '卤', '粉', '饼', '糕', '甜', '饮', '酒', '茶', '汁', '酱', '辣', '鲜', '香'];
    const newDish = [];
    const stillOther = [];
    otherPhotos.forEach(p => {
      const t = (p.title || '').toLowerCase();
      if (BROAD_DISH.some(kw => t.includes(kw))) {
        newDish.push(p);
      } else {
        stillOther.push(p);
      }
    });
    if (newDish.length > 0) {
      dishPhotos.push(...newDish);
      otherPhotos.length = 0;
      otherPhotos.push(...stillOther);
    }
  }

  // 严格排序：第1张环境 → 第2-3张菜品（不够用other补，还不够用剩余env补）
  const result = [];
  
  // 位置1：环境图
  if (envPhotos.length > 0) {
    result.push(envPhotos.shift());
  } else if (dishPhotos.length > 0) {
    result.push(dishPhotos.shift());
  } else if (otherPhotos.length > 0) {
    result.push(otherPhotos.shift());
  }

  // 位置2-3：菜品图优先，不够用 other 补，还不够用 env 补
  const pos23 = [];
  while (pos23.length < 2) {
    if (dishPhotos.length > 0) pos23.push(dishPhotos.shift());
    else if (otherPhotos.length > 0) pos23.push(otherPhotos.shift());
    else if (envPhotos.length > 0) pos23.push(envPhotos.shift());
    else break;
  }
  result.push(...pos23);

  // 剩余：菜品 → other → 环境
  result.push(...dishPhotos);
  result.push(...otherPhotos);
  result.push(...envPhotos);

  if (result.length === 0) {
    return pool.map(p => ({ title: p.title, url: p.url }));
  }

  return result.map(p => ({ title: p.title, url: p.url }));
}

function convertPOIToRestaurant(poi) {
  const location = poi.location.split(',');
  
  const business = poi.business || poi.biz_ext || {};
  const price = business.cost ? parseInt(business.cost, 10) : null;
  const rating = business.rating ? parseFloat(business.rating) : null;
  const rawDistance = poi.distance ? parseInt(poi.distance, 10) : null;
  
  const photos = sortPhotosByQuality(poi.photos);

  // 高德的 tags 来源：
  // 1. poi.type: 菜系分类路径，如 "餐饮相关场所;中式餐饮;火锅"
  // 2. business.tag: 特色标签，如 "烧烤,火锅,家庭聚会"
  const typeTags = poi.type ? poi.type.split(';').filter(t => t.trim()) : [];
  const featureTags = business.tag
    ? business.tag.split(/[,，;；\s]+/).filter(t => t.trim().length > 0)
    : [];
  
  // 合并去重，所有标签都用于搜索匹配和融合检测
  const allTags = [...new Set([...typeTags, ...featureTags])];

  return {
    id: poi.id,
    name: poi.name,
    cuisine: typeTags[0] || '餐饮',
    price: price,
    rating: rating || 4.0,
    reviewCount: 0,
    distance: rawDistance ? Math.round(rawDistance / 80) : 10,
    distanceMeters: rawDistance || 0,
    tags: typeTags.slice(0, 5),
    featureTags,
    features: allTags,
    photos,
    atmosphere: '',
    address: poi.address,
    phone: poi.tel || '',
    businessHours: business.open_time || business.opentime_today || '',
    lng: parseFloat(location[0]),
    lat: parseFloat(location[1]),
  };
}

export async function getIPLocation() {
  // Mock 模式
  if (!WEB_KEY) {
    return {
      city: '北京市',
      province: '北京市',
      source: 'mock',
    };
  }

  try {
    const data = await callAmapWithRetry('https://restapi.amap.com/v3/ip', {
      key: WEB_KEY,
    });

    if (data.city) {
      const result = {
        city: data.city,
        province: data.province || '',
        source: 'ip',
      };
      return result;
    }
    return null;
  } catch (error) {
    console.error('[amapService] IP定位失败:', error);
    // 10021 限流时返回 mock 北京兜底，至少不阻断后续定位流程
    if (error?.infocode === '10021') {
      return { city: '北京市', province: '北京市', source: 'mock_throttled' };
    }
    return null;
  }
}
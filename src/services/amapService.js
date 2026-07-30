import { mockRestaurants } from '../data/mockRestaurants';

// 优先读取环境变量，其次读取 public/config.js 中的默认配置
const appConfig = window.APP_CONFIG || {};
const WEB_KEY = import.meta.env.VITE_AMAP_WEB_KEY || appConfig.AMAP_WEB_KEY || '';
const JS_KEY = import.meta.env.VITE_AMAP_KEY || appConfig.AMAP_KEY || '';
export const IS_MOCK_MODE = !WEB_KEY;

let jsonpCounter = 0;

// Mock 搜索：在没有 API Key 时使用
function mockSearch(keyword, location, radius = 3000) {
  const keywordLower = keyword.toLowerCase();
  const results = mockRestaurants.filter(r => {
    const nameMatch = r.name.toLowerCase().includes(keywordLower);
    const cuisineMatch = r.cuisine.toLowerCase().includes(keywordLower);
    const tagMatch = r.tags?.some(t => t.toLowerCase().includes(keywordLower));
    const featureMatch = r.features?.some(f => f.toLowerCase().includes(keywordLower));
    return nameMatch || cuisineMatch || tagMatch || featureMatch;
  });
  
  // 根据距离过滤
  if (results.length === 0) {
    // 如果没有匹配，返回所有餐厅
    return mockRestaurants.map(r => ({
      ...r,
      distance: Math.floor(Math.random() * 80) + 5,
      distanceMeters: Math.floor(Math.random() * 5000) + 500,
      lng: location?.lng || 116.4706,
      lat: location?.lat || 39.9997,
    }));
  }
  
  return results.map(r => ({
    ...r,
    distance: Math.floor(Math.random() * 40) + 2,
    distanceMeters: Math.floor(Math.random() * 3000) + 200,
    lng: location?.lng || 116.4706,
    lat: location?.lat || 39.9997,
  }));
}

// Mock 地理编码
function mockGeocode(address) {
  return {
    lng: 116.4706,
    lat: 39.9997,
    name: address || 'Mock Location',
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
      resolve(data);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error('网络请求失败'));
    };

    document.head.appendChild(script);
  });
}

export async function searchPOI(keyword, location, radius = 3000, minRadius = 0, maxRadius = 0, pageNum = 1, pageSize = 25) {
  // Mock 模式：没有 API Key 时使用本地数据
  if (!WEB_KEY) {
    return mockSearch(keyword, location, radius);
  }

  try {
    const data = await jsonp('https://restapi.amap.com/v5/place/around', {
      key: WEB_KEY,
      keywords: keyword,
      location: `${location.lng},${location.lat}`,
      radius: radius.toString(),
      page_size: pageSize.toString(),
      page_num: pageNum.toString(),
      show_fields: 'business,photos',
    });


    if (data.status === '1' && data.pois) {
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
  // Mock 模式
  if (!WEB_KEY) {
    return mockGeocode(address);
  }

  try {
    const data = await jsonp('https://restapi.amap.com/v3/geocode/geo', {
      key: WEB_KEY,
      address: address,
    });


    if (data.status === '1' && data.geocodes && data.geocodes.length > 0) {
      const location = data.geocodes[0].location.split(',');
      const result = {
        lng: parseFloat(location[0]),
        lat: parseFloat(location[1]),
        name: address,
      };
      return result;
    }
    return null;
  } catch (error) {
    console.error('[amapService] 地理编码失败:', error);
    return null;
  }
}

export async function regeocode(lng, lat) {
  // Mock 模式
  if (!WEB_KEY) {
    return '北京市朝阳区望京SOHO';
  }

  try {
    const data = await jsonp('https://restapi.amap.com/v3/geocode/regeo', {
      key: WEB_KEY,
      location: `${lng},${lat}`,
    });
    
    if (data.status === '1' && data.regeocode) {
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
    const data = await jsonp('https://restapi.amap.com/v3/ip', {
      key: WEB_KEY,
    });


    if (data.status === '1' && data.city) {
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
    return null;
  }
}
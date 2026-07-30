import { useState, useCallback, useEffect, useRef } from 'react';
import { defaultLocation } from '../data/mockRestaurants';
import { regeocode, geocode, getIPLocation } from '../services/amapService';

const AMAP_KEY = import.meta.env.VITE_AMAP_KEY || '';
const GLOBAL_TIMEOUT = 15000;

const ERROR_MESSAGES = {
  1: '定位权限被拒绝，请检查浏览器设置',
  2: '位置信息不可用',
  3: '定位请求超时',
};

export function useLocation() {
  const [location, setLocation] = useState(defaultLocation);
  const [isLocating, setIsLocating] = useState(true);
  const [error, setError] = useState(null);
  const [debugInfo, setDebugInfo] = useState([]);
  const timeoutRef = useRef(null);
  const hasLocatedRef = useRef(false);

  const addDebug = useCallback((msg) => {
    setDebugInfo(prev => [...prev.slice(-5), msg]);
  }, []);

  const finishLocating = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsLocating(false);
  }, []);

  const updateLocationWithAddress = useCallback(async (lat, lng, source) => {
    if (hasLocatedRef.current) return;
    hasLocatedRef.current = true;
    addDebug(`定位成功: ${source}, 坐标: ${lat},${lng}`);

    let locationName = '当前位置';
    
    try {
      const address = await Promise.race([
        regeocode(lng, lat),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
      ]);
      if (address) {
        locationName = address.length > 20 ? address.slice(0, 20) + '...' : address;
        addDebug(`逆地理编码成功: ${address}`);
      }
    } catch (e) {
      addDebug('逆地理编码失败，使用默认名称');
    }

    setLocation({ name: locationName, lat, lng });
    setError(null);
    finishLocating();
  }, [finishLocating, addDebug]);

  const doBrowserLocate = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) {
        reject({ code: 2, message: '浏览器不支持定位' });
        return;
      }

      if (navigator.permissions && navigator.permissions.query) {
        navigator.permissions.query({ name: 'geolocation' }).then(permission => {
          addDebug(`权限状态: ${permission.state}`);
        }).catch(e => {
          addDebug(`权限查询失败: ${e.message}`);
        });
      }

      const timer = setTimeout(() => {
        reject({ code: 3, message: '定位请求超时' });
      }, 10000);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          clearTimeout(timer);
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            source: 'browser',
          });
        },
        (err) => {
          clearTimeout(timer);
          reject({
            code: err.code,
            message: err.message,
          });
        },
        {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 0,
        }
      );
    });
  }, []);

  const tryAmapLocate = useCallback(() => {
    return new Promise((resolve, reject) => {
      if (!AMAP_KEY) {
        reject(new Error('未配置高德地图 Key'));
        return;
      }

      const timer = setTimeout(() => {
        reject(new Error('高德定位超时'));
      }, 8000);

      const scriptUrl = `https://webapi.amap.com/maps?v=2.0&key=${AMAP_KEY}&plugin=AMap.Geolocation`;

      if (window.AMap) {
        addDebug('高德地图已加载，开始定位');
        initGeolocation(resolve, reject, timer);
      } else {
        addDebug(`开始加载高德地图: ${scriptUrl}`);
        const script = document.createElement('script');
        script.src = scriptUrl;
        script.onload = () => {
          addDebug('高德地图加载成功');
          initGeolocation(resolve, reject, timer);
        };
        script.onerror = () => {
          clearTimeout(timer);
          addDebug('高德地图加载失败');
          reject(new Error('高德地图加载失败'));
        };
        document.head.appendChild(script);
      }

      function initGeolocation(resolve, reject, timer) {
        try {
          if (!window.AMap.Geolocation) {
            addDebug('正在加载 Geolocation 插件');
            window.AMap.plugin('AMap.Geolocation', () => {
              startLocate(resolve, reject, timer);
            });
          } else {
            startLocate(resolve, reject, timer);
          }
        } catch (e) {
          clearTimeout(timer);
          addDebug(`初始化失败: ${e.message}`);
          reject(e);
        }
      }

      function startLocate(resolve, reject, timer) {
        try {
          const geolocation = new window.AMap.Geolocation({
            enableHighAccuracy: false,
            timeout: 5000,
          });

          geolocation.getCurrentPosition((status, result) => {
            clearTimeout(timer);
            if (status === 'complete' && result.position) {
              addDebug(`高德定位成功: ${result.position.lat},${result.position.lng}`);
              resolve({
                lat: result.position.lat,
                lng: result.position.lng,
                source: 'amap',
              });
            } else {
              const msg = result.message || '高德定位失败';
              addDebug(`高德定位失败: ${msg}`);
              reject(new Error(msg));
            }
          });
        } catch (e) {
          clearTimeout(timer);
          addDebug(`定位调用失败: ${e.message}`);
          reject(e);
        }
      }
    });
  }, []);



  const doLocate = useCallback(async () => {
    if (hasLocatedRef.current) return;
    
    addDebug('========== 开始定位 ==========');
    setIsLocating(true);
    setError(null);

    timeoutRef.current = setTimeout(() => {
      if (!hasLocatedRef.current) {
        hasLocatedRef.current = true;
        addDebug('全局超时');
        setError('定位超时，请手动输入位置');
        finishLocating();
      }
    }, GLOBAL_TIMEOUT);

    try {
      addDebug('步骤1: 尝试浏览器定位');
      const result = await doBrowserLocate();
      await updateLocationWithAddress(result.lat, result.lng, '浏览器定位');
    } catch (browserErr) {
      addDebug(`步骤1失败: 错误码${browserErr.code}, ${browserErr.message}`);
      
      if (AMAP_KEY && !hasLocatedRef.current) {
        try {
          addDebug('步骤2: 尝试高德地图定位');
          const amapResult = await tryAmapLocate();
          await updateLocationWithAddress(amapResult.lat, amapResult.lng, '高德定位');
          return;
        } catch (amapErr) {
          addDebug(`步骤2失败: ${amapErr.message}`);
        }
      }

      if (AMAP_KEY && !hasLocatedRef.current) {
        try {
          addDebug('步骤3: 尝试IP定位');
          const ipResult = await getIPLocation();
          if (!ipResult) {
            throw new Error('IP定位失败');
          }
          const geoResult = await geocode(ipResult.city);
          if (geoResult) {
            await updateLocationWithAddress(geoResult.lat, geoResult.lng, `IP定位(${ipResult.city})`);
          } else {
            throw new Error('IP定位后无法获取坐标');
          }
          return;
        } catch (ipErr) {
          addDebug(`步骤3失败: ${ipErr.message}`);
        }
      }

      if (!hasLocatedRef.current) {
        hasLocatedRef.current = true;
        const message = ERROR_MESSAGES[browserErr.code] || browserErr.message || '定位失败';
        setError(message);
        finishLocating();
      }
    }
  }, [doBrowserLocate, updateLocationWithAddress, finishLocating, tryAmapLocate, addDebug]);

  const retryLocate = useCallback(() => {
    hasLocatedRef.current = false;
    setDebugInfo([]);
    doLocate();
  }, [doLocate]);

  const updateLocation = useCallback((newLocation) => {
    hasLocatedRef.current = true;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setLocation(newLocation);
    setError(null);
    setIsLocating(false);
  }, []);

  useEffect(() => {
    addDebug(`环境检测: secureContext=${window.isSecureContext}, hostname=${window.location.hostname}`);
    addDebug(`API Key: JS=${AMAP_KEY ? '已配置' : '未配置'}, WEB=${!!import.meta.env.VITE_AMAP_WEB_KEY}`);
    addDebug(`浏览器: ${navigator.userAgent.split(' ').slice(-1)[0]}`);
    doLocate();
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [doLocate, addDebug]);

  return {
    location,
    isLocating,
    error,
    debugInfo,
    retryLocate,
    updateLocation,
  };
}

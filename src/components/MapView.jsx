import { useEffect, useRef, useState } from 'react';

const appConfig = window.APP_CONFIG || {};
const AMAP_KEY = import.meta.env.VITE_AMAP_KEY || appConfig.AMAP_KEY || '';

export default function MapView({ restaurants, center }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    if (!AMAP_KEY) {
      return;
    }

    if (window.AMap) {
      initMap();
      return;
    }

    const script = document.createElement('script');
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${AMAP_KEY}`;
    script.onload = () => {
      setMapLoaded(true);
      initMap();
    };
    script.onerror = () => {
      console.error('高德地图加载失败');
    };
    document.head.appendChild(script);

    return () => {
      if (mapInstance.current) {
        mapInstance.current.destroy();
        mapInstance.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!mapInstance.current || !restaurants || restaurants.length === 0) return;

    mapInstance.current.clearMap();

    restaurants.forEach((restaurant, index) => {
      const position = restaurant.lng && restaurant.lat 
        ? [restaurant.lng, restaurant.lat] 
        : [116.4706 + index * 0.002, 39.9997 + index * 0.001];

      const marker = new window.AMap.Marker({
        position: position,
        title: restaurant.name,
        content: `<div style="padding:4px 8px;background:#E85D3A;color:#fff;border-radius:4px;font-size:12px;font-weight:bold;">${index + 1}</div>`,
        offset: new window.AMap.Pixel(-14, -14),
      });
      marker.setMap(mapInstance.current);

      const infoWindow = new window.AMap.InfoWindow({
        content: `
          <div style="padding:10px;min-width:200px;">
            <div style="font-weight:bold;font-size:14px;margin-bottom:4px;color:#1a1a1a;">${restaurant.name}</div>
            <div style="font-size:12px;color:#666;margin-bottom:6px;">${restaurant.cuisine} · 人均${restaurant.price}元</div>
            <div style="font-size:12px;color:#888;margin-bottom:6px;">步行约${restaurant.distance}分钟</div>
            <div style="font-size:12px;color:#888;">${restaurant.address || ''}</div>
          </div>
        `,
        offset: new window.AMap.Pixel(0, -35),
      });

      marker.on('click', () => {
        infoWindow.open(mapInstance.current, marker.getPosition());
      });
    });

    if (restaurants.length > 0 && restaurants[0].lng && restaurants[0].lat) {
      mapInstance.current.setCenter([restaurants[0].lng, restaurants[0].lat]);
    }
  }, [restaurants, mapLoaded]);

  const initMap = () => {
    if (!window.AMap || mapInstance.current) return;

    mapInstance.current = new window.AMap.Map(mapRef.current, {
      zoom: 15,
      center: center ? [center.lng, center.lat] : [116.4706, 39.9997],
      viewMode: '2D',
    });
  };

  if (!AMAP_KEY) {
    return (
      <div className="w-full h-64 bg-rule-light rounded-apple flex items-center justify-center text-ink-tertiary text-sm">
        配置 VITE_AMAP_KEY 后显示地图
      </div>
    );
  }

  return (
    <div
      ref={mapRef}
      className="w-full h-64 rounded-apple overflow-hidden border border-rule"
    />
  );
}

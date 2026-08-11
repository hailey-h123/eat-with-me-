import { useState, useEffect } from 'react';
import {
  IconMapPin, IconClock, IconStar, IconNavigation, IconChevronLeft,
  IconLightbulb, IconCheck, IconCheckCircle, IconWallet
} from './icons/FancyIcons';
import Mascot from './Mascot';
import { FoodDecor } from './Mascot';

export default function DetailView({
  restaurantId,
  fetchRestaurant,
  onBack
}) {
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    if (fetchRestaurant && restaurantId) {
      fetchRestaurant(restaurantId)
        .then((data) => {
          if (!mounted) return;
          if (data) {
            setInfo(data);
          } else {
            setError('notFound');
          }
        })
        .catch(() => {
          if (mounted) setError('notFound');
        })
        .finally(() => {
          if (mounted) setLoading(false);
        });
    } else {
      setLoading(false);
    }
    return () => { mounted = false; };
  }, [restaurantId, fetchRestaurant]);

  const getIsOpenNow = (businessHours) => {
    if (!businessHours) return false;
    if (businessHours === '全天营业') return true;
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const parseTime = (str) => {
      const [h, m] = str.split(':').map(Number);
      return h * 60 + m;
    };
    const match = businessHours.match(/(\d{1,2}:\d{2})\s*[-~至]\s*(\d{1,2}:\d{2})/);
    if (match) {
      const open = parseTime(match[1]);
      const close = parseTime(match[2]);
      return currentMinutes >= open && currentMinutes <= close;
    }
    return false;
  };

  const handleNavigate = () => {
    if (!info) return;
    if (info.lng && info.lat) {
      window.open(`https://uri.amap.com/marker?position=${info.lng},${info.lat}&name=${encodeURIComponent(info.name)}&coordinate=gaode&callnative=1`, '_blank');
    } else if (info.address) {
      window.open(`https://www.amap.com/search?query=${encodeURIComponent(info.address)}`, '_blank');
    } else {
      window.open(`https://www.amap.com/search?query=${encodeURIComponent(info.name || '')}`, '_blank');
    }
  };

  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-6 py-16 text-center">
        <div className="relative inline-block mb-6">
          <Mascot mood="thinking" size={100} />
          <FoodDecor type="sparkle" size={12} className="pointer-events-none absolute top-0 -right-2 float-animation opacity-50" />
        </div>
        <h3 className="text-xl font-bold text-text mb-2">加载餐厅详情中...</h3>
        <p className="text-text-secondary text-sm">马上就好...</p>
      </div>
    );
  }

  if (error === 'notFound' || !info) {
    return (
      <div className="max-w-lg mx-auto px-6 py-16 text-center">
        <div className="relative inline-block mb-6">
          <Mascot mood="sad" size={100} />
          <FoodDecor type="soup" size={16} className="pointer-events-none absolute -bottom-2 -left-3 opacity-40" />
        </div>
        <h3 className="text-xl font-bold text-text mb-2">餐厅不存在</h3>
        <p className="text-text-secondary text-sm mb-8">餐厅可能已下线或者位置不对</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button onClick={onBack} className="btn-secondary px-5 py-2.5 text-sm">返回</button>
          <button onClick={onBack} className="btn-primary px-5 py-2.5 text-sm">试试搜索附近的餐厅</button>
        </div>
      </div>
    );
  }

  const isOpen = getIsOpenNow(info.businessHours);
  const walkMinutes = typeof info.distance === 'number' ? info.distance : (info.walkMinutes || 0);

  return (
    <div className="max-w-lg mx-auto px-6 py-6 fade-in">
      <div className="flex items-center justify-between mb-5">
        <button onClick={onBack} className="text-primary text-sm font-medium flex items-center gap-1">
          <IconChevronLeft className="w-5 h-5" /> 返回
        </button>
        {typeof info.matchScore === 'number' && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-text-muted font-medium">匹配度评分</span>
            <span className={`px-3 py-1 rounded-full text-sm font-extrabold ${info.matchScore >= 85 ? 'text-secondary' : info.matchScore >= 70 ? 'text-primary' : 'text-text-secondary'}`}
              style={{ fontFamily: 'var(--font-display)' }}>
              {Math.round(info.matchScore * 10) / 10}
            </span>
          </div>
        )}
      </div>

      <div className="fancy-card overflow-hidden mb-5">
        {info.photos && info.photos.length > 0 && (
          <div className="w-full h-56 overflow-hidden" style={{ borderBottom: '2.5px solid var(--color-ink)' }}>
            <img
              src={info.photos[0].url}
              alt={info.name}
              className="w-full h-full object-cover"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </div>
        )}
        <div className="p-6">
          <h2 className="text-2xl font-extrabold text-text mb-2" style={{ fontFamily: 'var(--font-display)' }}>
            {info.name}
          </h2>
          <div className="flex items-center gap-3 flex-wrap mb-4 text-sm">
            <span className="flex items-center gap-1.5 text-text-secondary">
              <IconWallet className="w-4 h-4 text-primary" />
              <span className="font-medium">人均价格</span>
              <span className="text-text font-bold">{`¥${info.price}`}</span>
            </span>
            <span className="text-text-muted">·</span>
            <span className="flex items-center gap-1.5">
              <IconStar className="w-4 h-4" style={{ color: 'var(--color-accent-dark)' }} />
              <span className="font-medium">用户评分</span>
              <span className="text-text font-bold">{info.rating}</span>
            </span>
          </div>

          <div className="flex flex-wrap gap-2 mb-5">
            {info.cuisine && (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-bg-soft text-text-secondary border-2 border-ink"
                style={{ borderColor: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>
                所属分类：{info.cuisine}
              </span>
            )}
            {info.soloFriendly >= 70 && (
              <span className="px-3 py-1 rounded-full text-xs font-bold text-white border-2 border-ink shadow-[2px_2px_0_var(--color-ink)]"
                style={{ background: 'var(--color-grass)', borderColor: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>
                一人食友好
              </span>
            )}
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary border-2 border-ink"
              style={{ borderColor: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>
              <span className="font-medium">距离</span>：{`步行${walkMinutes}分钟`}
            </span>
          </div>

          <div className="space-y-3 mb-5">
            <div className="flex items-start gap-2 text-sm bg-bg-soft border-2 border-ink rounded-xl px-3 py-2.5" style={{ borderColor: 'var(--color-ink)' }}>
              <IconMapPin className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-bold text-text mb-0.5">详细地址</div>
                <div className="text-text-secondary">{info.address}</div>
              </div>
            </div>
            <div className="flex items-start gap-2 text-sm bg-bg-soft border-2 border-ink rounded-xl px-3 py-2.5" style={{ borderColor: 'var(--color-ink)' }}>
              <IconClock className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-bold text-text mb-0.5">营业时间</div>
                <div className="flex items-center gap-2">
                  <span className="text-text-secondary">{info.businessHours || '全天营业'}</span>
                  {info.businessHours === '全天营业' ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-secondary/15 text-secondary font-bold">全天营业</span>
                  ) : isOpen ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-secondary/15 text-secondary font-bold">正在营业</span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-text-muted/20 text-text-muted font-bold">尚未营业</span>
                  )}
                </div>
                {info.open && (
                  <div className="text-text-muted text-xs mt-1">开放时间：{info.open}</div>
                )}
              </div>
            </div>
          </div>

          {info.reasons && info.reasons.length > 0 && (
            <div className="p-4 bg-bg-soft rounded-xl border-2 border-ink" style={{ borderColor: 'var(--color-ink)' }}>
              <div className="flex items-center gap-2 mb-3">
                <IconLightbulb className="w-4 h-4 text-primary" />
                <span className="font-bold text-text" style={{ fontFamily: 'var(--font-display)' }}>推荐理由</span>
              </div>
              <div className="space-y-2">
                {info.reasons.map((reason, index) => (
                  <div key={index} className="text-sm flex items-start gap-2 text-text">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center bg-white border-2 border-ink text-secondary text-[12px] leading-none mt-0.5" style={{ borderColor: 'var(--color-ink)' }}>
                      <IconCheck className="w-3 h-3" />
                    </span>
                    <span className="leading-relaxed font-medium">{reason.text || reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {info.perPerson && (
            <div className="mt-4 text-xs text-text-muted flex items-center gap-1">
              <IconCheckCircle className="w-3.5 h-3.5 text-secondary" />
              <span>人均：{info.perPerson}</span>
            </div>
          )}
        </div>
      </div>

      <button onClick={handleNavigate}
        className="btn-primary w-full py-3.5 text-base font-bold flex items-center justify-center gap-2 mb-4">
        <IconNavigation className="w-5 h-5" /> 导航到这里
      </button>

      <button onClick={onBack} className="btn-secondary w-full py-3 text-sm font-medium">
        返回
      </button>
    </div>
  );
}

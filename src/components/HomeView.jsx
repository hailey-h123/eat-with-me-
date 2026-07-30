import { useState, useEffect } from 'react';
import Mascot, { FoodDecor } from './Mascot';
import { IconSparkles, IconChevronRight, IconHistory, IconMapPin, IconClock } from './icons/FancyIcons';
import { getTimeSlot } from '../services/recommendationService';
import { searchPOI } from '../services/amapService';
import { useTranslation } from '../i18n';

const getTimeConfig = (t) => ({
  breakfast: {
    greeting: t('greeting.morning'),
    mood: 'drool',
    bgClass: 'hero-gradient',
    heroStyle: { background: 'linear-gradient(135deg, #FFF5D6 0%, #FFFBF0 60%, #FFEAB3 100%)' },
    bannerLabel: t('banner.breakfast'),
    keywords: '早餐|粥|包子|豆浆|面馆',
    bubble: t('bubble.morning'),
  },
  morning: {
    greeting: t('greeting.lateMorning'),
    mood: 'expect',
    bgClass: 'hero-gradient',
    heroStyle: undefined,
    bannerLabel: t('banner.lunch'),
    keywords: '简餐|快餐|便当|面馆|套餐',
    bubble: t('bubble.lunch'),
  },
  lunch: {
    greeting: t('greeting.noon'),
    mood: 'drool',
    bgClass: 'hero-gradient',
    heroStyle: { background: 'linear-gradient(135deg, #FFE8DD 0%, #FFFBF0 50%, #FFF4DE 100%)' },
    bannerLabel: t('banner.noonHot'),
    keywords: '快餐|面馆|套餐|简餐|便当',
    bubble: t('bubble.noon'),
  },
  afternoon: {
    greeting: t('greeting.afternoon'),
    mood: 'sleepy',
    bgClass: 'hero-gradient',
    heroStyle: { background: 'linear-gradient(135deg, #FFE8F0 0%, #FFFBF0 50%, #FFF0E8 100%)' },
    bannerLabel: t('banner.tea'),
    keywords: '咖啡|奶茶|甜品|蛋糕|下午茶',
    bubble: t('bubble.afternoon'),
  },
  dinner: {
    greeting: t('greeting.evening'),
    mood: 'expect',
    bgClass: 'hero-gradient',
    heroStyle: { background: 'linear-gradient(135deg, #FFF0DF 0%, #FFFBF0 50%, #FFE8CC 100%)' },
    bannerLabel: t('banner.dinner'),
    keywords: '餐厅|火锅|烧烤|日料|牛排',
    bubble: t('bubble.evening'),
  },
  late_night: {
    greeting: t('greeting.night'),
    mood: 'think',
    bgClass: 'hero-gradient',
    heroStyle: { background: 'linear-gradient(135deg, #EAE4F0 0%, #F5F0FA 50%, #E8DCF0 100%)' },
    bannerLabel: t('banner.nightOpen'),
    keywords: '夜宵|烧烤|火锅|粥|面馆',
    bubble: t('bubble.night'),
  },
});

export default function HomeView({ onSelectSolo, onSelectGroup, onOpenHistory, location, onQuickPick }) {
  const { t } = useTranslation();
  const timeSlot = getTimeSlot();
  const config = getTimeConfig(t)[timeSlot] || getTimeConfig(t).lunch;

  // 时间彩蛋横幅
  const [quickPicks, setQuickPicks] = useState([]);
  const [picksLoading, setPicksLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!location || !location.lat || !location.lng) return;

    setPicksLoading(true);
    searchPOI(config.keywords, location, 3000, 0, 0, 1, 5)
      .then(results => {
        if (cancelled) return;
        if (results && results.length > 0) {
          setQuickPicks(results.slice(0, 3));
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setPicksLoading(false); });

    return () => { cancelled = true; };
  }, [location?.lat, location?.lng, timeSlot]);

  return (
    <div className="relative max-w-2xl mx-auto px-6 pt-8 pb-16">
      {/* 背景漂浮装饰 */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <FoodDecor type="fork" size={28} className="absolute left-[6%] top-[18%] opacity-40 float-animation hidden sm:block" style={{ animationDelay: '0s' }} />
        <FoodDecor type="chili" size={24} className="absolute right-[8%] top-[12%] opacity-40 float-animation hidden sm:block" style={{ animationDelay: '1.2s' }} />
        <FoodDecor type="bowl" size={30} className="absolute left-[10%] top-[55%] opacity-30 float-animation hidden sm:block" style={{ animationDelay: '2s' }} />
        <FoodDecor type="star" size={20} className="absolute right-[12%] top-[48%] opacity-50 float-animation" style={{ animationDelay: '0.6s' }} />
        <FoodDecor type="mushroom" size={26} className="absolute left-[4%] top-[75%] opacity-35 float-animation hidden md:block" style={{ animationDelay: '1.5s' }} />
        <FoodDecor type="heart" size={22} className="absolute right-[6%] top-[78%] opacity-40 float-animation hidden md:block" style={{ animationDelay: '0.9s' }} />
        <FoodDecor type="egg" size={24} className="absolute left-[20%] top-[8%] opacity-30 float-animation hidden md:block" style={{ animationDelay: '2.4s' }} />
        <FoodDecor type="sparkle" size={18} className="absolute right-[22%] top-[30%] opacity-50 float-animation" style={{ animationDelay: '1.8s' }} />
        <FoodDecor type="noodle" size={26} className="absolute left-[88%] top-[62%] opacity-30 float-animation hidden md:block" style={{ animationDelay: '0.3s' }} />
        <FoodDecor type="leaf" size={20} className="absolute left-[2%] top-[40%] opacity-35 float-animation hidden md:block" style={{ animationDelay: '2.7s' }} />
      </div>

      {/* Hero 区：吉祥物 + 标题（动态） */}
      <div className={`relative overflow-hidden mb-6 p-6 sm:p-8 ${config.bgClass}`} style={config.heroStyle}>
        {/* Hero 内部角落小涂鸦 */}
        <FoodDecor type="sparkle" size={16} className="pointer-events-none absolute top-3 left-4 opacity-60 float-animation" style={{ animationDelay: '0.5s' }} />
        <FoodDecor type="heart" size={14} className="pointer-events-none absolute top-5 right-6 opacity-50 float-animation" style={{ animationDelay: '1.1s' }} />
        <FoodDecor type="star" size={12} className="pointer-events-none absolute bottom-4 left-8 opacity-50 float-animation" style={{ animationDelay: '1.6s' }} />
        <FoodDecor type="egg" size={16} className="pointer-events-none absolute bottom-6 right-4 opacity-40 float-animation" style={{ animationDelay: '0.4s' }} />

        <div className="relative flex flex-col items-center text-center">
          {/* 吉祥物打招呼 */}
          <div className="relative mb-4">
            <Mascot mood={config.mood} size={120} />
            {/* 打招呼气泡 */}
            <div className="absolute -top-2 -right-10 bg-white border-2 border-ink rounded-2xl px-3 py-1.5 shadow-[3px_3px_0_var(--color-ink)]" style={{ borderColor: 'var(--color-ink)' }}>
              <span className="text-xs font-bold text-text" style={{ fontFamily: 'var(--font-display)' }}>{config.bubble}</span>
              <div className="absolute -bottom-1.5 left-5 w-3 h-3 bg-white border-r-2 border-b-2 rotate-45" style={{ borderColor: 'var(--color-ink)' }} />
            </div>
          </div>

          <h2 className="text-3xl sm:text-5xl font-extrabold mb-2" style={{ fontFamily: 'var(--font-display)' }}>
            <span className="gradient-text">{t('home.title')}</span>
          </h2>

          <p className="text-sm sm:text-lg text-text-secondary mb-5 max-w-md mx-auto leading-relaxed font-bold" style={{ fontFamily: 'var(--font-display)' }}>
            {config.greeting}
          </p>

          <div className="flex items-center justify-center gap-2 text-[10px] sm:text-xs font-bold text-primary bg-white border-2 rounded-full px-3 sm:px-4 py-1.5 sm:py-2 shadow-[3px_3px_0_var(--color-ink)] whitespace-nowrap" style={{ borderColor: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>
            <IconSparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>{t('home.subtitle')}</span>
          </div>
        </div>
      </div>

      {/* 时间彩蛋横幅 */}
      {quickPicks.length > 0 && (
        <div className="mb-8 slide-up fancy-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <IconClock className="w-4 h-4 text-primary" />
            <span className="text-sm font-extrabold text-text" style={{ fontFamily: 'var(--font-display)' }}>
              {config.bannerLabel}
            </span>
            <span className="text-xs text-text-muted hidden sm:inline">{t('home.tapToExplore')}</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {quickPicks.map((r, i) => (
              <button
                key={r.id}
                type="button"
                onClick={() => onQuickPick(r)}
                className="text-left bg-white border-2 border-ink rounded-2xl p-3.5 hover:bg-bg-soft transition-all hover:-translate-y-0.5 hover:shadow-[3px_3px_0_var(--color-ink)] shadow-[2px_2px_0_var(--color-ink)]"
              >
                <p className="text-sm font-extrabold text-text truncate mb-1" style={{ fontFamily: 'var(--font-display)' }}>{r.name}</p>
                <div className="flex items-center gap-2 text-xs text-text-muted">
                  <span className="flex items-center gap-1">
                    <IconMapPin className="w-3 h-3" />
                    {t('home.walkMinutes', { minutes: r.distance })}
                  </span>
                  {r.price && <span>{t('home.perPerson', { price: r.price })}</span>}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 加载中骨架 */}
      {picksLoading && quickPicks.length === 0 && (
        <div className="mb-8 fancy-card p-5 slide-up">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-4 h-4 rounded-full bg-bg-soft animate-pulse" />
            <div className="w-24 h-4 rounded-full bg-bg-soft animate-pulse" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-bg-soft rounded-2xl p-3.5 animate-pulse">
                <div className="w-3/4 h-4 rounded-full bg-white mb-2" />
                <div className="w-1/2 h-3 rounded-full bg-white" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 模式选择卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <button type="button" onClick={onSelectSolo} className="group text-left">
          <div className="fancy-card p-8 relative">
            <FoodDecor type="spoon" size={18} className="pointer-events-none absolute top-3 left-3 opacity-40 group-hover:opacity-70 transition-opacity" />
            <FoodDecor type="sparkle" size={16} className="pointer-events-none absolute bottom-3 right-3 opacity-40 group-hover:opacity-70 transition-opacity" />
            <div className="relative">
              <div className="relative w-20 h-20 mb-6">
                <div className="absolute inset-0 bg-primary rounded-2xl border-2.5 border-ink shadow-[4px_4px_0_var(--color-ink)] group-hover:shadow-[6px_6px_0_var(--color-ink)] transition-all" style={{ borderColor: 'var(--color-ink)' }} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Mascot mood="drool" size={56} float={false} />
                </div>
              </div>
              <h3 className="text-2xl font-extrabold text-text mb-2" style={{ fontFamily: 'var(--font-display)' }}>{t('home.solo')}</h3>
              <p className="text-text-secondary text-sm leading-relaxed mb-5">
                {t('home.soloDesc')}
              </p>
              <div className="flex items-center gap-2 text-primary font-bold text-sm group-hover:gap-3 transition-all" style={{ fontFamily: 'var(--font-display)' }}>
                <span>{t('home.soloBtn')}</span>
                <span className="w-7 h-7 bg-primary/15 rounded-full flex items-center justify-center border-2 border-ink shadow-[2px_2px_0_var(--color-ink)]" style={{ borderColor: 'var(--color-ink)' }}>
                  <IconChevronRight className="w-4 h-4" />
                </span>
              </div>
            </div>
          </div>
        </button>

        <button type="button" onClick={onSelectGroup} className="group text-left">
          <div className="fancy-card p-8 relative">
            <FoodDecor type="fork" size={18} className="pointer-events-none absolute top-3 left-3 opacity-40 group-hover:opacity-70 transition-opacity" />
            <FoodDecor type="heart" size={16} className="pointer-events-none absolute bottom-3 right-3 opacity-40 group-hover:opacity-70 transition-opacity" />
            <div className="relative">
              <div className="relative w-20 h-20 mb-6">
                <div className="absolute inset-0 bg-secondary rounded-2xl border-2.5 border-ink shadow-[4px_4px_0_var(--color-ink)] group-hover:shadow-[6px_6px_0_var(--color-ink)] transition-all" style={{ borderColor: 'var(--color-ink)' }} />
                <div className="absolute inset-0 flex items-center justify-center gap-1">
                  <Mascot mood="happy" size={40} float={false} />
                  <Mascot mood="expect" size={40} float={false} />
                </div>
              </div>
              <h3 className="text-2xl font-extrabold text-text mb-2" style={{ fontFamily: 'var(--font-display)' }}>{t('home.group')}</h3>
              <p className="text-text-secondary text-sm leading-relaxed mb-5">
                {t('home.groupDesc')}
              </p>
              <div className="flex items-center gap-2 text-secondary font-bold text-sm group-hover:gap-3 transition-all" style={{ fontFamily: 'var(--font-display)' }}>
                <span>{t('home.groupBtn')}</span>
                <span className="w-7 h-7 bg-secondary/15 rounded-full flex items-center justify-center border-2 border-ink shadow-[2px_2px_0_var(--color-ink)]" style={{ borderColor: 'var(--color-ink)' }}>
                  <IconChevronRight className="w-4 h-4" />
                </span>
              </div>
            </div>
          </div>
        </button>
      </div>

      {/* 功能入口：历史记录 */}
      <div className="mt-8 flex items-center justify-center gap-3">
        <button
          onClick={onOpenHistory}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-text-secondary bg-white border-2 hover:bg-bg-soft transition-all shadow-[2px_2px_0_var(--color-ink)]"
          style={{ borderColor: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}
        >
          <IconHistory className="w-4 h-4" />
          <span>{t('home.favorites')}</span>
        </button>
      </div>

      {/* 底部装饰 */}
      <div className="mt-14 flex flex-col items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="decorative-dot" />
          <div className="decorative-dot" style={{ background: 'var(--color-secondary)' }} />
          <div className="decorative-dot" style={{ background: 'var(--color-grass)' }} />
        </div>
        <p className="text-text-muted text-xs font-bold" style={{ fontFamily: 'var(--font-display)' }}>
          AI 驱动的美食推荐引擎
        </p>
      </div>
    </div>
  );
}

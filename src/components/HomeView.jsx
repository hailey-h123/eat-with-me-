import { useState, useEffect, useRef } from 'react';
import Mascot, { FoodDecor } from './Mascot';
import {
  IconChevronRight, IconMapPin, IconRefreshCw, IconStar,
  IconWalking,
} from './icons/FancyIcons';
import { EmojiToIcon } from './icons/FoodIcons';
import { getTimeSlot } from '../services/recommendationService';
import { searchPOI, IS_MOCK_MODE, isQuotaExceeded } from '../services/amapService';
import { getAvatar } from '../services/profileService';

const getTimeConfig = () => ({
  breakfast: {
    greeting: '早啊！来份元气早餐',
    mood: 'drool',
    heroStyle: { background: 'linear-gradient(135deg, #FFF5D6 0%, #FFFBF0 60%, #FFEAB3 100%)' },
    keywords: '早餐|粥|包子|豆浆|面馆',
    bubble: '早！吃啥？',
  },
  morning: {
    greeting: '上午好，提前想想中午吃啥',
    mood: 'expect',
    heroStyle: undefined,
    keywords: '简餐|快餐|便当|面馆|套餐',
    bubble: '想想吃啥？',
  },
  lunch: {
    greeting: '午饭时间到！让我来帮你选',
    mood: 'drool',
    heroStyle: { background: 'linear-gradient(135deg, #FFE8DD 0%, #FFFBF0 50%, #FFF4DE 100%)' },
    keywords: '快餐|面馆|套餐|简餐|便当',
    bubble: '饿了！吃啥？',
  },
  afternoon: {
    greeting: '下午茶时间，来杯咖啡配甜点',
    mood: 'sleepy',
    heroStyle: { background: 'linear-gradient(135deg, #FFE8F0 0%, #FFFBF0 50%, #FFF0E8 100%)' },
    keywords: '咖啡|奶茶|甜品|蛋糕|下午茶',
    bubble: '困了...来杯啥？',
  },
  dinner: {
    greeting: '晚饭吃点什么好的呢？',
    mood: 'expect',
    heroStyle: { background: 'linear-gradient(135deg, #FFF0DF 0%, #FFFBF0 50%, #FFE8CC 100%)' },
    keywords: '餐厅|火锅|烧烤|日料|牛排',
    bubble: '晚上吃点好的！',
  },
  late_night: {
    greeting: '深夜觅食模式启动',
    mood: 'think',
    heroStyle: { background: 'linear-gradient(135deg, #EAE4F0 0%, #F5F0FA 50%, #E8DCF0 100%)' },
    keywords: '夜宵|烧烤|火锅|粥|面馆',
    bubble: '夜深了...还吃吗？',
  },
});

const FEED_PAGE_SIZE = 5;
const MOCK_FEED_SIZE = 3;

const GENERIC_CUISINES = new Set([
  '餐饮', '餐饮服务', '餐饮相关场所', '餐饮相关', '餐厅', '餐馆', '饭馆',
  '饮食', '食品', '美食', '中式餐饮', '外国餐厅', '小吃快餐店', '快餐厅',
  '饮品店', '茶艺馆', '酒吧', '冷饮店', '糕饼店', '面包店', '烘焙甜品',
]);

// Detect if running on a real mobile device (not just narrow window)
const isRealMobileDevice = () => {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  // Check for mobile OS indicators
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Silk/i.test(ua)) {
    // iPad can sometimes report as desktop in some modes
    // Also check screen size as a secondary signal
    if (typeof window !== 'undefined' && window.innerWidth <= 1024) {
      return true;
    }
    // iPhone/Android are always mobile regardless
    if (/iPhone|iPod|Android/i.test(ua)) return true;
  }
  return false;
};

// viewport scale: 0 at mobile, 1 at desktop
// For real mobile devices, force aggressive scaling
const calcVScale = () => {
  if (typeof window === 'undefined') return 1;

  // If it's a real mobile device, force low scale for smaller UI
  if (isRealMobileDevice()) {
    // Use matchMedia to check actual CSS viewport
    const isNarrow = window.matchMedia('(max-width: 520px)').matches;
    if (isNarrow) {
      // True small screen (phone)
      return 0.35;
    }
    // Tablet or large phone
    return 0.55;
  }

  // Desktop / responsive window mode
  const w = window.innerWidth;
  return Math.max(0.2, Math.min(1, (w - 320) / 480));
};

// Linear interpolate between min and max based on vscale
const lerp = (min, max, scale) => min + (max - min) * scale;

export default function HomeView({
  onSelectMood,
  onSelectExplore,
  onSelectGroup,
  onFortunePick,
  onOpenProfile,
  onQuickPick,
  location,
}) {
  const timeSlot = getTimeSlot();
  const config = getTimeConfig()[timeSlot] || getTimeConfig().lunch;

  const [avatar] = useState(() => getAvatar());

  const [vscale, setVscale] = useState(() => {
    if (typeof window === 'undefined') return 1;
    const w = window.innerWidth;
    const s = calcVScale();
    console.log('[HomeView] calcVScale:', { width: w, vscale: s, ua: navigator.userAgent.slice(0, 60) });
    return s;
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => {
      const w = window.innerWidth;
      const s = calcVScale();
      console.log('[HomeView] resize:', { width: w, vscale: s });
      setVscale(s);
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('orientationchange', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('orientationchange', onResize);
    };
  }, []);

  // 附近 feed
  const [feedPool, setFeedPool] = useState([]);
  const [feedOffset, setFeedOffset] = useState(0);
  const [feedLoading, setFeedLoading] = useState(false);
  const feedSeqRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    if (!location || !location.lat || !location.lng) return;
    const seq = ++feedSeqRef.current;

    setFeedLoading(true);
    searchPOI(config.keywords, location, 3000, 0, 0, 1, 25)
      .then(results => {
        if (cancelled || seq !== feedSeqRef.current) return;
        setFeedPool((results || []).filter(r => r && r.id));
        setFeedOffset(0);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled && seq === feedSeqRef.current) setFeedLoading(false); });

    return () => { cancelled = true; };
  }, [location?.lat, location?.lng, timeSlot]);

  const baseFeedSize = IS_MOCK_MODE ? MOCK_FEED_SIZE : FEED_PAGE_SIZE;
  const feedSize = baseFeedSize;
  const feedItems = feedPool.length > 0
    ? Array.from({ length: Math.min(feedSize, feedPool.length) }, (_, i) => feedPool[(feedOffset + i) % feedPool.length])
    : [];

  const handleFeedRefresh = () => {
    if (feedPool.length === 0) return;
    setFeedOffset(prev => (prev + feedSize) % Math.max(1, feedPool.length));
  };

  // 提取餐厅标签：优先 featureTags → photos.title → poi.type → features
  // 过滤规则：只接受 ≤ 6 个字符的 tag（超长就跳过拿下一个），保证完全显示，视觉整齐。
  const MAX_TAG_LEN = 6;
  const getRestaurantTags = (r) => {
    const picked = [];
    const cuisineVal = (r.cuisine || '').trim();
    const pushUniq = (t) => {
      if (!t) return;
      const s = String(t).trim();
      // 硬约束：超过 6 字的 tag 直接跳过（不让它占位置，继续拿下一个短的）
      if (s.length > MAX_TAG_LEN) return;
      if (!s) return;
      if (['餐饮', '餐饮服务', '餐饮相关场所', '餐厅', '美食', '餐馆'].includes(s)) return;
      if (cuisineVal && (s === cuisineVal || s.includes(cuisineVal) || cuisineVal.includes(s))) return;
      // 子串包含去重
      for (const existing of picked) {
        if (existing === s) return;
        if (existing.includes(s) || s.includes(existing)) return;
      }
      picked.push(s);
    };

    // 1. 优先全取 featureTags（高德 business.tag）——最干净、最不容易重复
    const featureTags = Array.isArray(r.featureTags) ? r.featureTags : [];
    for (const t of featureTags) {
      pushUniq(t);
      if (picked.length >= 2) break;
    }

    // 2. featureTags 不够 2 个时，用 photos.title（招牌菜名）补
    if (picked.length < 2 && Array.isArray(r.photos)) {
      for (const p of r.photos) {
        const t = p && p.title;
        if (t) {
          if (/^[\u4e00-\u9fa5A-Za-z0-9·]{2,14}$/.test(t.trim())) {
            pushUniq(t.trim());
            if (picked.length >= 2) break;
          }
        }
      }
    }

    // 3. 还差几个，用 poi.type 细分菜系补（倒序取末段，跳过与 cuisine 重复的）
    if (picked.length < 2) {
      const typeTags = Array.isArray(r.tags) ? r.tags : [];
      for (let i = typeTags.length - 1; i >= 0; i--) {
        pushUniq(typeTags[i]);
        if (picked.length >= 2) break;
      }
    }

    // 4. 最后的兜底：features 全量标签
    if (picked.length < 2) {
      const features = Array.isArray(r.features) ? r.features : [];
      for (const t of features) {
        pushUniq(t);
        if (picked.length >= 2) break;
      }
    }
    return picked.slice(0, 2);
  };
  // 菜系：优先 r.cuisine；空则从 r.type（餐饮 > 外国餐厅 > 日料）里剥最后一级
  const getCuisineLabel = (r) => {
    if (r.cuisine) return r.cuisine;
    if (r.type) {
      const parts = String(r.type).split(/[>:：]/).map(s => s.trim()).filter(Boolean);
      if (parts.length >= 3) return parts[parts.length - 1];
    }
    return null;
  };

  const quickActions = [
    { key: 'mood', emoji: '🎯', label: '按心情选', desc: '根据当下的心情和状态', onClick: onSelectMood, color: 'var(--color-primary)' },
    { key: 'explore', emoji: '🧭', label: '探索未知', desc: '按距离搜索被埋没的宝藏店', onClick: onSelectExplore, color: 'var(--color-secondary)' },
    { key: 'group', emoji: '👥', label: '多人聚餐', desc: '综合所有人的需求', onClick: onSelectGroup, color: 'var(--color-accent)' },
    { key: 'fortune', emoji: '🔮', label: '今日运势', desc: '抽卡决定吃什么', onClick: onFortunePick, color: '#7c5cff' },
  ];

  // Scale helper values
  const heroPadding = lerp(10, 24, vscale);
  const mascotSize = lerp(52, 84, vscale);
  const bubbleFontSize = lerp(9, 12, vscale);
  const mainTitleSize = lerp(22, 40, vscale);
  const subTitleSize = lerp(11, 16, vscale);
  const avatarSize = lerp(28, 40, vscale);
  const gridIconSize = lerp(28, 44, vscale);
  const gridTitleSize = lerp(9, 13, vscale);
  const gridDescSize = lerp(7, 10, vscale);
  const gridPadding = lerp(5, 14, vscale);

  // Feed-specific scaling: DRAMATICALLY smaller for mobile
  // Mobile: feedScale=0.20 → imgSize=16px, padding=4.4px (much smaller)
  // Desktop: feedScale=1.0 → imgSize=48px, padding=14px
  const feedScale = isRealMobileDevice() ? 0.20 : Math.pow(vscale, 1.5);
  const feedLerp = (min, max) => lerp(min, max, feedScale);
  const feedCardPadding = feedLerp(2, 14);
  const feedImgSize = feedLerp(8, 48);
  const feedNameSize = feedLerp(7, 14);
  const feedMetaSize = feedLerp(5, 11);
  const headerIconSize = lerp(10, 16, vscale);
  const feedGap = feedLerp(2, 12);
  const feedTagPaddingY = feedLerp(1, 2);
  const feedTagPaddingX = feedLerp(2, 7);
  const feedChevronSize = feedLerp(5, 12);
  const feedStarSize = feedLerp(4, 10);
  const feedRefreshIcon = feedLerp(7, 14);
  const feedRefreshFont = feedLerp(7, 12);
  const feedTitleFont = feedLerp(9, 14);
  const feedTitleMb = feedLerp(2, 12);
  const feedMetaIcon = feedLerp(5, 10);
  const feedTagFont = feedLerp(5, 10);
  const feedDemoFont = feedLerp(4, 11);
  const feedDemoMargin = feedLerp(0, 8);

  return (
    <div
      className="relative h-full max-w-2xl mx-auto flex flex-col min-h-0"
      style={{ paddingLeft: `${lerp(10, 24, vscale)}px`, paddingRight: `${lerp(10, 24, vscale)}px`, paddingTop: `${lerp(4, 16, vscale)}px`, paddingBottom: `${lerp(4, 16, vscale)}px` }}
    >
      {/* DEBUG: remove after diagnosis */}
      <div style={{ position: 'fixed', top: 0, left: 0, right: 0, background: '#FF0000', color: 'white', zIndex: 99999, fontSize: '14px', padding: '4px 8px', fontWeight: 'bold' }}>
        vscale={vscale.toFixed(3)} width={typeof window !== 'undefined' ? window.innerWidth : 'ssr'}
      </div>
      {/* END DEBUG */}

      {/* ===== Hero 问候卡：始终使用 fancy-card 保留黑色描边 ===== */}
      <div
        className="relative overflow-hidden mb-2 flex-shrink-0 fancy-card"
        style={{ ...config.heroStyle, padding: `${heroPadding}px` }}
      >
        {/* 装饰元素：始终保留，等比缩放 */}
        <FoodDecor type="sparkle" size={lerp(8, 14, vscale)} className="pointer-events-none absolute float-animation opacity-60" style={{ top: `${lerp(6, 12, vscale)}px`, left: `${lerp(10, 16, vscale)}px`, animationDelay: '0.5s' }} />
        <FoodDecor type="heart" size={lerp(7, 12, vscale)} className="pointer-events-none absolute float-animation opacity-60 text-peach" style={{ top: `${lerp(8, 16, vscale)}px`, right: `${lerp(60, 80, vscale)}px`, animationDelay: '1.2s' }} />
        <FoodDecor type="egg" size={lerp(8, 14, vscale)} className="pointer-events-none absolute float-animation opacity-40" style={{ bottom: `${lerp(6, 12, vscale)}px`, right: `${lerp(10, 16, vscale)}px`, animationDelay: '0.4s' }} />

        {/* 头像入口 */}
        <button
          type="button"
          onClick={onOpenProfile}
          aria-label="进入我的主页"
          className="absolute z-10 rounded-full bg-white border-2 flex items-center justify-center hover:scale-110 transition-transform shadow-[2px_2px_0_var(--color-ink)]"
          style={{ borderColor: 'var(--color-ink)', top: `${lerp(6, 12, vscale)}px`, right: `${lerp(6, 12, vscale)}px`, width: `${avatarSize}px`, height: `${avatarSize}px`, fontSize: `${lerp(14, 18, vscale)}px` }}
        >
          {avatar}
        </button>

        <div className="relative flex flex-col items-center text-center" style={{ paddingTop: `${lerp(4, 8, vscale)}px` }}>
          <div className="relative" style={{ marginBottom: `${lerp(4, 8, vscale)}px` }}>
            <Mascot mood={config.mood} size={mascotSize} />
            <div
              className="absolute bg-white border-2 border-ink rounded-2xl shadow-[3px_3px_0_var(--color-ink)]"
              style={{ borderColor: 'var(--color-ink)', top: `${lerp(-2, -4, vscale)}px`, right: `${lerp(-28, -40, vscale)}px`, padding: `${lerp(3, 5, vscale)}px ${lerp(6, 10, vscale)}px` }}
            >
              <span className="font-bold text-text" style={{ fontFamily: 'var(--font-display)', fontSize: `${bubbleFontSize}px` }}>{config.bubble}</span>
              <div className="absolute bg-white border-r-2 border-b-2 rotate-45" style={{ borderColor: 'var(--color-ink)', bottom: `${lerp(-2, -4, vscale)}px`, left: `${lerp(8, 14, vscale)}px`, width: `${lerp(8, 12, vscale)}px`, height: `${lerp(8, 12, vscale)}px` }} />
            </div>
          </div>

          <h1
            className="font-extrabold leading-none"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--color-primary)', fontSize: `${mainTitleSize}px`, marginTop: `${lerp(4, 8, vscale)}px`, marginBottom: `${lerp(2, 4, vscale)}px` }}
          >
            今天怎么吃？
          </h1>
          <p className="text-text-secondary font-bold" style={{ fontFamily: 'var(--font-display)', fontSize: `${subTitleSize}px`, marginTop: `${lerp(2, 4, vscale)}px` }}>
            {config.greeting}
          </p>
        </div>
      </div>

      {/* ===== 4 宫格快捷入口 ===== */}
      <div className="grid grid-cols-4 gap-1.5 flex-shrink-0" style={{ marginBottom: `${lerp(8, 24, vscale)}px` }}>
        {quickActions.map((action, i) => (
          <button
            key={action.key}
            type="button"
            onClick={action.onClick}
            className="outline-card text-center flex flex-col items-center slide-up hover:-translate-y-0.5 transition-transform"
            style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'both', padding: `${gridPadding}px`, gap: `${lerp(4, 8, vscale)}px` }}
          >
            <div
              className="relative rounded-2xl border-2 border-ink flex items-center justify-center shadow-[2.5px_2.5px_0_var(--color-ink)] flex-shrink-0"
              style={{ borderColor: 'var(--color-ink)', background: action.color, width: `${gridIconSize}px`, height: `${gridIconSize}px` }}
            >
              <EmojiToIcon emoji={action.emoji} size={lerp(16, 22, vscale)} className="text-white" />
            </div>
            <span className="font-extrabold text-text leading-tight" style={{ fontFamily: 'var(--font-display)', fontSize: `${gridTitleSize}px` }}>{action.label}</span>
            <span className="text-text-muted text-center leading-tight" style={{ fontSize: `${gridDescSize}px`, display: vscale > 0.15 ? 'block' : 'none' }}>{action.desc}</span>
          </button>
        ))}
      </div>

      {/* ===== 附近餐厅 feed ===== */}
      <section className="flex-1 min-h-0 flex flex-col">
        {/* FORCE DEBUG: show current feedScale */}
        <div style={{ background: 'yellow', color: 'black', fontSize: '12px', padding: '4px', marginBottom: '8px', fontWeight: 'bold' }}>
          DEBUG feedScale = {feedScale.toFixed(3)} | vscale = {vscale.toFixed(3)} | imgSize = {feedImgSize.toFixed(1)}px
        </div>
        <div className="flex items-center justify-between flex-shrink-0" style={{ marginBottom: `${feedTitleMb}px` }}>
          <h3 className="font-extrabold text-text flex items-center gap-1.5" style={{ fontFamily: 'var(--font-display)', fontSize: `${feedTitleFont}px` }}>
            <IconMapPin className="text-primary" style={{ width: `${headerIconSize}px`, height: `${headerIconSize}px` }} /> 附近餐厅推荐
          </h3>
          {feedPool.length > feedSize && (
            <button
              type="button"
              onClick={handleFeedRefresh}
              className="font-bold text-primary flex items-center gap-1 hover:gap-1.5 transition-all"
              style={{ fontFamily: 'var(--font-display)', fontSize: `${feedRefreshFont}px` }}
            >
              <IconRefreshCw style={{ width: `${feedRefreshIcon}px`, height: `${feedRefreshIcon}px` }} /> 换一批
            </button>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto pr-0.5" style={{ paddingBottom: `${feedLerp(2, 8)}px` }}>
          {feedLoading && feedItems.length === 0 ? (
            <div className="space-y-2" style={{ gap: `${feedGap}px` }}>
              {Array.from({ length: feedSize }, (_, i) => (
                <div key={i} className="flat-card animate-pulse" style={{ padding: `${feedCardPadding}px` }}>
                  <div className="flex items-center" style={{ gap: `${feedGap}px` }}>
                    <div className="rounded-xl bg-bg-soft" style={{ width: `${feedImgSize}px`, height: `${feedImgSize}px` }} />
                    <div className="flex-1" style={{ gap: `${feedLerp(2, 5)}px` }}>
                      <div className="rounded-full bg-bg-soft" style={{ width: '66%', height: `${feedLerp(8, 14)}px` }} />
                      <div className="rounded-full bg-bg-soft" style={{ width: '50%', height: `${feedLerp(5, 9)}px` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : feedItems.length === 0 ? (
            <div className="flat-card text-center text-text-muted" style={{ padding: `${feedLerp(8, 18)}px`, fontSize: `${feedLerp(9, 13)}px` }}>
              {isQuotaExceeded() ? '今日高德查询额度已用完，明日自动恢复' : '附近暂无推荐，试试重新定位'}
            </div>
          ) : (
            <>
              <div className="space-y-2" style={{ gap: `${feedGap}px` }}>
                {feedItems.map(r => {
                  const tags = getRestaurantTags(r);
                  const cuisine = getCuisineLabel(r);
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => onQuickPick(r)}
                      className="w-full flat-card text-left flex items-center animate-slide-up"
                      style={{ padding: `${feedCardPadding}px`, gap: `${feedGap}px` }}
                    >
                      {r.photos?.[0]?.url ? (
                        <img src={r.photos[0].url} alt={r.name} className="rounded-xl object-cover border-2 flex-shrink-0" style={{ width: `${feedImgSize}px`, height: `${feedImgSize}px`, borderColor: 'var(--color-ink)' }} loading="lazy" />
                      ) : (
                        <div className="rounded-xl bg-bg-soft border-2 flex items-center justify-center flex-shrink-0" style={{ width: `${feedImgSize}px`, height: `${feedImgSize}px`, borderColor: 'var(--color-ink)' }}>
                          <IconMapPin className="text-text-muted" style={{ width: `${feedLerp(12, 18)}px`, height: `${feedLerp(12, 18)}px` }} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="font-extrabold text-text truncate" style={{ fontFamily: 'var(--font-display)', fontSize: `${feedNameSize}px` }}>{r.name}</p>
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-1 gap-y-0.5 text-text-muted leading-tight" style={{ fontSize: `${feedMetaSize}px` }}>
                          {r.rating > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-accent-dark font-semibold flex-shrink-0">
                              <IconStar className="inline align-text-bottom" style={{ width: `${feedStarSize}px`, height: `${feedStarSize}px` }} filled />
                              {r.rating.toFixed ? r.rating.toFixed(1) : r.rating}
                            </span>
                          )}
                          <span className="inline-flex items-center gap-0.5 flex-shrink-0">
                            <IconWalking style={{ width: `${feedMetaIcon}px`, height: `${feedMetaIcon}px` }} />
                            {r.distance || '?'}分
                          </span>
                          {r.price > 0 && (
                            <span className="font-medium flex-shrink-0">¥{r.price}/人</span>
                          )}
                          {(() => {
                            const showCuisine = cuisine && !GENERIC_CUISINES.has(cuisine);
                            return (
                              <>
                                {showCuisine && (
                                  <>
                                    <span className="text-text-muted/60 flex-shrink-0">·</span>
                                    <span className="font-medium flex-shrink-0">{cuisine}</span>
                                  </>
                                )}
                                {tags.length > 0 && (
                                  <>
                                    {showCuisine && <span className="text-text-muted/60 flex-shrink-0">·</span>}
                                    <span className="inline-flex items-center gap-1 flex-wrap min-w-0 ml-1">
                                      {tags.map((t, i) => (
                                        <span
                                          key={i}
                                          title={t}
                                          className="inline-flex items-center rounded-full bg-primary/10 border border-ink/10 text-text/80 font-normal flex-shrink-0 whitespace-nowrap"
                                          style={{ fontSize: `${feedTagFont}px`, padding: `${feedTagPaddingY}px ${feedTagPaddingX}px` }}
                                        >
                                          {t}
                                        </span>
                                      ))}
                                    </span>
                                  </>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </div>
                      <IconChevronRight className="text-text-muted flex-shrink-0" style={{ width: `${feedChevronSize}px`, height: `${feedChevronSize}px` }} />
                    </button>
                  );
                })}
              </div>
              {IS_MOCK_MODE && (
                <p className="text-text-muted text-center" style={{ marginTop: `${feedDemoMargin}px`, fontSize: `${feedDemoFont}px` }}>
                  演示数据，接入高德 API 后才是你附近的真实餐厅
                </p>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}

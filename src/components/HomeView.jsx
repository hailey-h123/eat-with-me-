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
  // 手机端一屏塞不下太多，默认 2 条；桌面端保持原来的 3~5 条
  const [isNarrow, setIsNarrow] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 640;
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => setIsNarrow(window.innerWidth < 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
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

  return (
    <div className={`relative h-full max-w-2xl mx-auto px-3 sm:px-6 pt-1 sm:pt-4 pb-2 flex flex-col min-h-0 ${isNarrow ? '' : ''}`}>

      {/* ===== Hero 问候卡：吉祥物 + 头像入口 + 今天怎么吃主标题 ===== */}
      <div
        className={`relative overflow-hidden mb-2 flex-shrink-0 ${isNarrow ? 'p-3' : 'p-5 sm:p-6 fancy-card'}`}
        style={config.heroStyle}
      >
        {!isNarrow && (
          <>
            <FoodDecor type="sparkle" size={14} className="pointer-events-none absolute top-3 left-4 opacity-60 float-animation" style={{ animationDelay: '0.5s' }} />
            <FoodDecor type="heart" size={12} className="pointer-events-none absolute opacity-60 float-animation text-peach top-4 right-[60px]" style={{ animationDelay: '1.2s' }} />
            <FoodDecor type="egg" size={14} className="pointer-events-none absolute bottom-3 right-4 opacity-40 float-animation" style={{ animationDelay: '0.4s' }} />
          </>
        )}

        {/* 头像入口：Hero卡内部右上角 */}
        <button
          type="button"
          onClick={onOpenProfile}
          aria-label="进入我的主页"
          className={`absolute z-10 rounded-full bg-white border-2 flex items-center justify-center hover:scale-110 transition-transform shadow-[2px_2px_0_var(--color-ink)] ${isNarrow ? 'top-2 right-2 w-8 h-8 text-base' : 'top-3.5 right-3.5 sm:top-4 sm:right-4 w-10 h-10 text-xl'}`}
          style={{ borderColor: 'var(--color-ink)' }}
        >
          {avatar}
        </button>

        <div className={`relative flex flex-col items-center text-center ${isNarrow ? '' : 'pt-2'}`}>
          <div className={`relative ${isNarrow ? 'mb-1' : 'mb-2'}`}>
            <Mascot mood={config.mood} size={isNarrow ? 72 : 84} />
            <div
              className={`absolute bg-white border-2 border-ink rounded-2xl shadow-[3px_3px_0_var(--color-ink)] ${isNarrow ? '-top-1 -right-7 px-2 py-1' : '-top-2 -right-10 px-3 py-1.5'}`}
              style={{ borderColor: 'var(--color-ink)' }}
            >
              <span className={`${isNarrow ? 'text-[10px]' : 'text-xs'} font-bold text-text`} style={{ fontFamily: 'var(--font-display)' }}>{config.bubble}</span>
              <div className={`absolute bg-white border-r-2 border-b-2 rotate-45 ${isNarrow ? '-bottom-0.5 left-4 w-2.5 h-2.5' : '-bottom-1.5 left-5 w-3 h-3'}`} style={{ borderColor: 'var(--color-ink)' }} />
            </div>
          </div>

          {/* 主标题：今天怎么吃？ */}
          <h1
            className={`font-extrabold leading-none ${isNarrow ? 'text-[24px] mt-1' : 'mb-1 text-[34px] sm:text-[40px]'}`}
            style={{ fontFamily: 'var(--font-display)', color: 'var(--color-primary)' }}
          >
            今天怎么吃？
          </h1>
          {/* 副标题：动态问候语 */}
          <p className={`text-text-secondary font-bold ${isNarrow ? 'text-[11px] mt-0.5' : 'text-sm sm:text-base'}`} style={{ fontFamily: 'var(--font-display)' }}>
            {config.greeting}
          </p>
        </div>
      </div>

      {/* ===== 快捷操作 4 列横向卡片（风格和 SoloInput 分类页一致，尺寸适配一行4个） ===== */}
      <div className={`grid grid-cols-4 gap-1.5 mb-2 sm:mb-6 flex-shrink-0`}>
        {quickActions.map((action, i) => (
          <button key={action.key} type="button" onClick={action.onClick}
            className={`outline-card text-center flex flex-col items-center gap-1 sm:gap-2 slide-up hover:-translate-y-0.5 transition-transform ${isNarrow ? 'px-1 py-1.5' : 'p-3.5'}`}
            style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'both' }}>
            <div
              className={`relative rounded-2xl border-2 border-ink flex items-center justify-center shadow-[2.5px_2.5px_0_var(--color-ink)] ${isNarrow ? 'w-8 h-8' : 'w-11 h-11'}`}
              style={{ borderColor: 'var(--color-ink)', background: action.color }}
            >
              <EmojiToIcon emoji={action.emoji} size={isNarrow ? 16 : 22} className="text-white" />
            </div>
            <span className={`font-extrabold text-text leading-tight ${isNarrow ? 'text-[10px]' : 'text-xs'}`} style={{ fontFamily: 'var(--font-display)' }}>{action.label}</span>
            {!isNarrow && (
              <span className="text-[10px] text-text-muted text-center leading-tight">{action.desc}</span>
            )}
          </button>
        ))}
      </div>

      {/* ===== 附近餐厅 feed — 移动端占满剩余高度，内滚 ===== */}
      <section className="flex-1 min-h-0 flex flex-col">
        <div className={`flex items-center justify-between flex-shrink-0 ${isNarrow ? 'mb-1.5' : 'mb-3'}`}>
          <h3 className={`font-extrabold text-text flex items-center gap-1.5 ${isNarrow ? 'text-xs' : 'text-sm'}`} style={{ fontFamily: 'var(--font-display)' }}>
            <IconMapPin className={`text-primary ${isNarrow ? 'w-3.5 h-3.5' : 'w-4 h-4'}`} /> 附近餐厅推荐
          </h3>
          {feedPool.length > feedSize && (
            <button
              type="button"
              onClick={handleFeedRefresh}
              className={`font-bold text-primary flex items-center gap-1 hover:gap-1.5 transition-all ${isNarrow ? 'text-[10px]' : 'text-xs'}`}
              style={{ fontFamily: 'var(--font-display)' }}
            >
              <IconRefreshCw className={`${isNarrow ? 'w-3 h-3' : 'w-3.5 h-3.5'}`} /> 换一批
            </button>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto pr-0.5 pb-2">
        {feedLoading && feedItems.length === 0 ? (
          <div className={`space-y-2 sm:space-y-3.5`}>
            {Array.from({ length: feedSize }, (_, i) => (
              <div key={i} className={`flat-card animate-pulse ${isNarrow ? 'p-2' : 'p-3.5'}`}>
                <div className={`flex items-center ${isNarrow ? 'gap-2' : 'gap-3'}`}>
                  <div className={`rounded-xl bg-bg-soft ${isNarrow ? 'w-9 h-9' : 'w-12 h-12'}`} />
                  <div className={`flex-1 ${isNarrow ? 'space-y-1' : 'space-y-2'}`}>
                    <div className={`rounded-full bg-bg-soft ${isNarrow ? 'w-2/3 h-3' : 'w-2/3 h-4'}`} />
                    <div className={`rounded-full bg-bg-soft ${isNarrow ? 'w-1/2 h-2' : 'w-1/2 h-3'}`} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : feedItems.length === 0 ? (
          <div className={`flat-card text-center text-text-muted ${isNarrow ? 'p-3 text-[11px]' : 'p-6 text-sm'}`}>
            {isQuotaExceeded() ? '今日高德查询额度已用完，明日自动恢复' : '附近暂无推荐，试试重新定位'}
          </div>
        ) : (
          <>
            <div className={`space-y-2 sm:space-y-3.5`}>
              {feedItems.map(r => {
                const tags = getRestaurantTags(r);
                const cuisine = getCuisineLabel(r);
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => onQuickPick(r)}
                    className={`w-full flat-card text-left flex items-center animate-slide-up ${isNarrow ? 'p-2 gap-2' : 'p-3.5 gap-3'}`}
                  >
                    {r.photos?.[0]?.url ? (
                      <img src={r.photos[0].url} alt={r.name} className={`rounded-xl object-cover border-2 flex-shrink-0 ${isNarrow ? 'w-9 h-9' : 'w-12 h-12'}`} style={{ borderColor: 'var(--color-ink)' }} loading="lazy" />
                    ) : (
                      <div className={`rounded-xl bg-bg-soft border-2 flex items-center justify-center flex-shrink-0 ${isNarrow ? 'w-9 h-9' : 'w-12 h-12'}`} style={{ borderColor: 'var(--color-ink)' }}>
                        <IconMapPin className={`text-text-muted ${isNarrow ? 'w-4 h-4' : 'w-5 h-5'}`} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      {/* 店名独占一行 */}
                      <div className="flex items-center gap-1.5">
                        <p className={`font-extrabold text-text truncate ${isNarrow ? 'text-[12px]' : 'text-sm'}`} style={{ fontFamily: 'var(--font-display)' }}>{r.name}</p>
                      </div>
                      {/* 一横行：评分 · 时间 · 人均 · 菜系 · 3个tag */}
                      <div className={`mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-text-muted leading-tight ${isNarrow ? 'text-[10px]' : 'text-[11px]'}`}>
                        {r.rating > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-accent-dark font-semibold flex-shrink-0">
                            <IconStar className={`inline align-text-bottom ${isNarrow ? 'w-2 h-2' : 'w-2.5 h-2.5'}`} filled />
                            {r.rating.toFixed ? r.rating.toFixed(1) : r.rating}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-0.5 flex-shrink-0">
                          <IconWalking className={isNarrow ? 'w-2 h-2' : 'w-2.5 h-2.5'} />
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
                                        className={`inline-flex items-center rounded-full bg-primary/10 border border-ink/10 text-text/80 font-normal flex-shrink-0 whitespace-nowrap ${isNarrow ? 'text-[9px] px-1.5 py-px' : 'text-[10px] px-2 py-0.5'}`}
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
                    <IconChevronRight className={`text-text-muted flex-shrink-0 ${isNarrow ? 'w-3 h-3' : 'w-4 h-4'}`} />
                  </button>
                );
              })}
            </div>
            {IS_MOCK_MODE && (
              <p className={`text-text-muted text-center mt-2 sm:mt-3 ${isNarrow ? 'text-[9px]' : 'text-[11px]'}`}>
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

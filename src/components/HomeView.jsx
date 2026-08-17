import { useState, useEffect, useMemo, useRef } from 'react';
import Mascot, { FoodDecor } from './Mascot';
import {
  IconChevronRight, IconMapPin, IconRefreshCw, IconStar,
  IconSolo, IconGroup, IconDice, IconCrystalBall,
} from './icons/FancyIcons';
import { getTimeSlot } from '../services/recommendationService';
import { searchPOI, IS_MOCK_MODE } from '../services/amapService';
import { countSafeSignals } from '../services/scoringService';
import { getFavorites, getVisited, isVisited } from '../services/historyService';
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

export default function HomeView({
  onSelectSolo,
  onSelectGroup,
  onRandomPick,
  onFortunePick,
  onOpenProfile,
  onQuickPick,
  location,
}) {
  const timeSlot = getTimeSlot();
  const config = getTimeConfig()[timeSlot] || getTimeConfig().lunch;

  // 3 指标：本地同步读，避免闪烁
  const [favCount, setFavCount] = useState(0);
  const [visitedCount, setVisitedCount] = useState(0);
  const [avatar] = useState(() => getAvatar());

  // 运势星数：每次进首页随机一次（3.0-5.0）
  const fortuneStars = useMemo(() => Math.round((3 + Math.random() * 2) * 10) / 10, []);
  // 决定次数文案（问候语）
  const decisionText = useMemo(() => {
    try {
      const raw = localStorage.getItem('eatwithme_decision_count');
      const n = parseInt(raw, 10);
      return Number.isFinite(n) && n > 0 ? `你已决定过 ${n} 次吃什么啦 👏` : '今天也让我帮你决定吃什么吧';
    } catch { return '今天也让我帮你决定吃什么吧'; }
  }, []);

  // 附近 feed
  const [feedPool, setFeedPool] = useState([]);
  const [feedOffset, setFeedOffset] = useState(0);
  const [feedLoading, setFeedLoading] = useState(false);
  const feedSeqRef = useRef(0);

  useEffect(() => {
    setFavCount(getFavorites().length);
    setVisitedCount(getVisited().length);
  }, []);

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

  const feedSize = IS_MOCK_MODE ? MOCK_FEED_SIZE : FEED_PAGE_SIZE;
  const feedItems = feedPool.length > 0
    ? Array.from({ length: Math.min(feedSize, feedPool.length) }, (_, i) => feedPool[(feedOffset + i) % feedPool.length])
    : [];

  const handleFeedRefresh = () => {
    if (feedPool.length === 0) return;
    setFeedOffset(prev => (prev + feedSize) % Math.max(1, feedPool.length));
  };

  // 餐厅信号标签：优先级 去过 > 有不辣选项 > 鸳鸯锅可分
  const getSignalLabel = (r) => {
    if (r?.id && isVisited(r.id)) return '📍 去过';
    const allText = [...(r.tags || []), r.cuisine || '', r.name || ''].join('');
    if (allText.includes('火锅') || allText.includes('涮')) return '鸳鸯锅可分';
    if (countSafeSignals(r, '辣') > 0) return '有不辣选项';
    return null;
  };

  const quickActions = [
    { key: 'solo', icon: IconSolo, label: '一人食', desc: 'AI 帮你选', onClick: onSelectSolo, color: 'var(--color-primary)' },
    { key: 'group', icon: IconGroup, label: '多人聚餐', desc: '综合大家', onClick: onSelectGroup, color: 'var(--color-secondary)' },
    { key: 'random', icon: IconDice, label: '随便选', desc: '随机一家', onClick: onRandomPick, color: 'var(--color-accent)' },
    { key: 'fortune', icon: IconCrystalBall, label: '抽签吃', desc: '今日运势', onClick: onFortunePick, color: '#7c5cff' },
  ];

  return (
    <div className="relative max-w-2xl mx-auto px-4 sm:px-6 pt-4 pb-24">
      {/* ===== 顶部栏：位置 + 头像 ===== */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1.5 text-sm font-bold text-text min-w-0" style={{ fontFamily: 'var(--font-display)' }}>
          <IconMapPin className="w-4 h-4 text-primary flex-shrink-0" />
          <span className="truncate">{location?.name || '定位中…'}</span>
        </div>
        <button
          type="button"
          onClick={onOpenProfile}
          aria-label="进入我的主页"
          className="w-10 h-10 rounded-full bg-white border-2 flex items-center justify-center text-xl hover:scale-110 transition-transform shadow-[2px_2px_0_var(--color-ink)]"
          style={{ borderColor: 'var(--color-ink)' }}
        >
          {avatar}
        </button>
      </div>

      {/* ===== Hero 问候卡：吉祥物 + 3 指标 ===== */}
      <div className="relative overflow-hidden mb-6 p-6 sm:p-8 fancy-card" style={config.heroStyle}>
        <FoodDecor type="sparkle" size={16} className="pointer-events-none absolute top-3 left-4 opacity-60 float-animation" style={{ animationDelay: '0.5s' }} />
        <FoodDecor type="star" size={12} className="pointer-events-none absolute bottom-4 left-8 opacity-50 float-animation" style={{ animationDelay: '1.6s' }} />
        <FoodDecor type="egg" size={16} className="pointer-events-none absolute bottom-6 right-4 opacity-40 float-animation" style={{ animationDelay: '0.4s' }} />

        <div className="relative flex flex-col items-center text-center">
          <div className="relative mb-3">
            <Mascot mood={config.mood} size={96} />
            <div className="absolute -top-2 -right-10 bg-white border-2 border-ink rounded-2xl px-3 py-1.5 shadow-[3px_3px_0_var(--color-ink)]" style={{ borderColor: 'var(--color-ink)' }}>
              <span className="text-xs font-bold text-text" style={{ fontFamily: 'var(--font-display)' }}>{config.bubble}</span>
              <div className="absolute -bottom-1.5 left-5 w-3 h-3 bg-white border-r-2 border-b-2 rotate-45" style={{ borderColor: 'var(--color-ink)' }} />
            </div>
          </div>

          <p className="text-sm sm:text-base text-text-secondary mb-1 font-bold" style={{ fontFamily: 'var(--font-display)' }}>
            {config.greeting}
          </p>
          <p className="text-base sm:text-lg font-extrabold text-text mb-5" style={{ fontFamily: 'var(--font-display)' }}>
            {decisionText}
          </p>

          {/* 3 指标 */}
          <div className="grid grid-cols-3 gap-2.5 w-full max-w-sm">
            <MetricPill icon="❤️" value={favCount} label="收藏" />
            <MetricPill icon="👣" value={visitedCount} label="去过" />
            <MetricPill icon="⭐" value={fortuneStars} label="今日运势" />
          </div>
        </div>
      </div>

      {/* ===== 快捷操作 4 宫格 ===== */}
      <div className="grid grid-cols-4 gap-2.5 mb-6">
        {quickActions.map(action => {
          const Icon = action.icon;
          return (
            <button
              key={action.key}
              type="button"
              onClick={action.onClick}
              className="group fancy-card !p-0 py-4 flex flex-col items-center gap-1.5 hover:-translate-y-0.5 transition-transform"
            >
              <span
                className="w-11 h-11 rounded-2xl border-2 flex items-center justify-center shadow-[2px_2px_0_var(--color-ink)] group-hover:shadow-[3px_3px_0_var(--color-ink)] transition-all"
                style={{ borderColor: 'var(--color-ink)', background: `${action.color}1f`, color: action.color }}
              >
                <Icon className="w-5 h-5" />
              </span>
              <span className="text-xs font-extrabold text-text" style={{ fontFamily: 'var(--font-display)' }}>{action.label}</span>
              <span className="text-[10px] text-text-muted">{action.desc}</span>
            </button>
          );
        })}
      </div>

      {/* ===== 附近餐厅 feed ===== */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-extrabold text-text flex items-center gap-1.5" style={{ fontFamily: 'var(--font-display)' }}>
            <IconMapPin className="w-4 h-4 text-primary" /> 附近餐厅推荐
          </h3>
          {feedPool.length > feedSize && (
            <button
              type="button"
              onClick={handleFeedRefresh}
              className="text-xs font-bold text-primary flex items-center gap-1 hover:gap-1.5 transition-all"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              <IconRefreshCw className="w-3.5 h-3.5" /> 换一批
            </button>
          )}
        </div>

        {feedLoading && feedItems.length === 0 ? (
          <div className="space-y-2.5">
            {Array.from({ length: feedSize }, (_, i) => (
              <div key={i} className="fancy-card p-3.5 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-bg-soft" />
                  <div className="flex-1 space-y-2">
                    <div className="w-2/3 h-4 rounded-full bg-bg-soft" />
                    <div className="w-1/2 h-3 rounded-full bg-bg-soft" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : feedItems.length === 0 ? (
          <div className="fancy-card p-6 text-center text-sm text-text-muted">
            附近暂无推荐，试试重新定位
          </div>
        ) : (
          <>
            <div className="space-y-2.5">
              {feedItems.map(r => {
                const signal = getSignalLabel(r);
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => onQuickPick(r)}
                    className="w-full fancy-card p-3.5 text-left flex items-center gap-3 hover:-translate-y-0.5 transition-transform animate-slide-up"
                  >
                    {r.photos?.[0]?.url ? (
                      <img src={r.photos[0].url} alt={r.name} className="w-12 h-12 rounded-xl object-cover border-2 flex-shrink-0" style={{ borderColor: 'var(--color-ink)' }} loading="lazy" />
                    ) : (
                      <div className="w-12 h-12 rounded-xl bg-bg-soft border-2 flex items-center justify-center flex-shrink-0" style={{ borderColor: 'var(--color-ink)' }}>
                        <IconMapPin className="w-5 h-5 text-text-muted" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-extrabold text-text truncate" style={{ fontFamily: 'var(--font-display)' }}>{r.name}</p>
                        {r.rating > 0 && (
                          <span className="flex items-center gap-0.5 text-xs text-accent-dark font-medium flex-shrink-0">
                            <IconStar className="w-3 h-3" filled /> {r.rating}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-text-muted mt-0.5">
                        <span>🚶{r.distance || '?'}分</span>
                        {r.price > 0 && <span>¥{r.price}/人</span>}
                        {signal && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary border border-primary/30">
                            {signal}
                          </span>
                        )}
                      </div>
                    </div>
                    <IconChevronRight className="w-4 h-4 text-text-muted flex-shrink-0" />
                  </button>
                );
              })}
            </div>
            {IS_MOCK_MODE && (
              <p className="text-[11px] text-text-muted text-center mt-3">
                演示数据，接入高德 API 后才是你附近的真实餐厅
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function MetricPill({ icon, value, label }) {
  return (
    <div
      className="bg-white/80 border-2 rounded-xl py-2.5 px-1 text-center shadow-[2px_2px_0_var(--color-ink)]"
      style={{ borderColor: 'var(--color-ink)' }}
    >
      <div className="text-lg leading-none mb-1">{icon}</div>
      <div className="text-base font-extrabold text-text leading-none" style={{ fontFamily: 'var(--font-display)' }}>
        {value}
      </div>
      <div className="text-[10px] text-text-muted mt-1 leading-none">{label}</div>
    </div>
  );
}

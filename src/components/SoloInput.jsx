import { useState, useRef, useEffect, useMemo } from 'react';
import { IconChevronLeft, IconLoader2, IconRefreshCw, IconSparkle } from './icons/FancyIcons';
import { getSoloModes, getSoloModeCategories, drawFortuneCard, FORTUNE_CARDS } from '../services/recommendationService';
import { trackModeSelect } from '../services/analyticsService';
import { EmojiToIcon } from './icons/FoodIcons';
import Mascot, { FoodDecor } from './Mascot';
import LoadingOverlay from './LoadingOverlay';

// 面仔美食小贴士（每次进入页面随机取一条，不自动轮播避免跳变）
const FOOD_TIPS = [
  { emoji: '🍜', text: '听说楼下那家面馆的牛肉面，汤底熬了 8 个小时' },
  { emoji: '🌶️', text: '无辣不欢的人，运气一般不会太差' },
  { emoji: '🥟', text: '饺子要吃烫的，餐厅要选对的' },
  { emoji: '🍣', text: '日料店的师傅说：新鲜就是最好的调味料' },
  { emoji: '🔥', text: '没有什么烦恼是一顿火锅解决不了的' },
  { emoji: '🍰', text: '饭后甜点是另一个胃，别亏待它' },
  { emoji: '☕', text: '一杯好咖啡配一个悠闲下午，这才是生活' },
  { emoji: '🥗', text: '今天吃得健康，明天才能吃得放肆' },
  { emoji: '🍖', text: '烤肉滋滋作响的声音，是人间最美的旋律' },
  { emoji: '🧋', text: '奶茶三分糖，快乐十分满' },
];

function MascotTip() {
  const tip = useMemo(() => FOOD_TIPS[Math.floor(Math.random() * FOOD_TIPS.length)], []);
  return (
    <div className="outline-card p-4 flex items-center gap-4 slide-up" style={{ animationDelay: '400ms', animationFillMode: 'both' }}>
      <div className="relative flex-shrink-0">
        <Mascot mood="drool" size={56} float={false} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-extrabold text-text-muted mb-1" style={{ fontFamily: 'var(--font-display)' }}>面仔碎碎念</p>
        <p className="text-sm text-text-secondary leading-relaxed">
          <span className="mr-1.5">{tip.emoji}</span>
          {tip.text}
        </p>
      </div>
    </div>
  );
}

// 美食小插图列（纯装饰）
function FoodBanner() {
  const items = [
    { type: 'noodle', size: 28, delay: '0s' },
    { type: 'egg', size: 24, delay: '0.2s' },
    { type: 'chili', size: 26, delay: '0.4s' },
    { type: 'mushroom', size: 24, delay: '0.6s' },
    { type: 'dumpling', size: 26, delay: '0.8s' },
    { type: 'heart', size: 22, delay: '1s' },
    { type: 'sparkle', size: 20, delay: '1.2s' },
    { type: 'star', size: 22, delay: '1.4s' },
  ];
  return (
    <div className="flex items-center justify-center gap-5 py-6 slide-up overflow-hidden" style={{ animationDelay: '500ms', animationFillMode: 'both' }}>
      {items.map((item, i) => (
        <div key={i} className="float-animation opacity-50" style={{ animationDelay: item.delay }}>
          <FoodDecor type={item.type} size={item.size} />
        </div>
      ))}
    </div>
  );
}
const PRICE_MIN = 0;
const PRICE_MAX = 200;
const PRICE_STEP = 10;

// 美食分类标签（参考美团一级分类规则，每个标签配一个彩色小图标）
const TASTE_TAG_GROUPS = [
  { tags: [
    { label: '地方菜系', icon: '🍜' },
    { label: '火锅', icon: '🍲' },
    { label: '烧烤烤肉', icon: '🍢' },
    { label: '异域料理', icon: '🍣' },
    { label: '自助餐', icon: '🍖' },
    { label: '鱼鲜海鲜', icon: '🦐' },
    { label: '小吃快餐', icon: '🍔' },
    { label: '饮品店', icon: '☕' },
    { label: '面包蛋糕甜品', icon: '🍰' },
  ] },
];

function FortuneSlotMachine({ onCardDrawn }) {
  const [isSpinning, setIsSpinning] = useState(true);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [finalCard, setFinalCard] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [spinKey, setSpinKey] = useState(0);
  const intervalRef = useRef(null);
  const targetCard = useRef(null);

  const startSpin = () => {
    setIsSpinning(true);
    setShowResult(false);
    setFinalCard(null);
    targetCard.current = drawFortuneCard();
    let speed = 60;
    let elapsed = 0;
    const totalDuration = 2500;
    const tick = () => {
      setCurrentCardIndex(prev => (prev + 1) % FORTUNE_CARDS.length);
      elapsed += speed;
      if (elapsed > totalDuration * 0.5) speed = Math.min(speed * 1.18, 450);
      if (elapsed >= totalDuration) {
        clearTimeout(intervalRef.current);
        const finalIndex = FORTUNE_CARDS.findIndex(c => c.id === targetCard.current.id);
        setCurrentCardIndex(finalIndex >= 0 ? finalIndex : 0);
        setFinalCard(targetCard.current);
        setIsSpinning(false);
        setTimeout(() => setShowResult(true), 400);
        return;
      }
      intervalRef.current = setTimeout(tick, speed);
    };
    intervalRef.current = setTimeout(tick, speed);
  };

  useEffect(() => {
    startSpin();
    return () => { if (intervalRef.current) clearTimeout(intervalRef.current); };
  }, [spinKey]);

  const handleConfirm = () => { if (finalCard) onCardDrawn(finalCard); };
  const handleRedraw = () => { setSpinKey(k => k + 1); };
  const displayCard = FORTUNE_CARDS[currentCardIndex];

  return (
    <div className="flex flex-col items-center gap-5 py-4">
      {/* 吉祥物：转动中期待，结果出来惊讶 */}
      <div className="relative">
        <Mascot mood={isSpinning ? 'expect' : 'surprise'} size={72} />
        {/* 吉祥物周围漂浮装饰 */}
        <FoodDecor type="sparkle" size={14} className="pointer-events-none absolute -top-2 -left-3 float-animation opacity-70" style={{ animationDelay: '0.4s' }} />
        <FoodDecor type="star" size={12} className="pointer-events-none absolute -top-1 right-0 float-animation opacity-70" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative">
        <FoodDecor type="star" size={16} className="absolute -top-3 left-2 float-animation" style={{ animationDelay: '0.3s' }} />
        <FoodDecor type="star" size={14} className="absolute -top-2 right-4 float-animation" style={{ animationDelay: '0.8s' }} />
        <FoodDecor type="sparkle" size={12} className="pointer-events-none absolute -bottom-2 -left-3 float-animation opacity-70" style={{ animationDelay: '1.3s' }} />
        <FoodDecor type="heart" size={12} className="pointer-events-none absolute -bottom-1 -right-3 float-animation opacity-70" style={{ animationDelay: '0.6s' }} />
        <div className="relative fancy-card p-8">
          <div className="relative w-56 h-80" style={{ perspective: '1000px' }}>
            <div className={`absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-2xl transition-all duration-300 ${showResult ? '' : ''}`}
              style={{
                background: 'linear-gradient(180deg, #FFF4DE 0%, #FFFFFF 100%)',
                border: '2.5px solid var(--color-ink)',
                boxShadow: isSpinning ? '4px 4px 0 var(--color-primary)' : '4px 4px 0 var(--color-ink)',
              }}>
              <span className={`transition-all duration-150 ${isSpinning ? 'scale-90 opacity-70' : 'scale-100'}`}>
                <EmojiToIcon emoji={displayCard?.icon || '🔮'} size={56} className="text-primary" />
              </span>
              <p className="text-lg font-extrabold text-text" style={{ fontFamily: 'var(--font-display)' }}>{displayCard?.label || '占卜中...'}</p>
              {!isSpinning && finalCard && (
                <p className="text-xs text-text-secondary px-6 text-center fade-in leading-relaxed">{finalCard.message}</p>
              )}
            </div>
            {isSpinning && <div className="absolute -inset-2 rounded-2xl border-2 border-primary/40 animate-pulse" style={{ borderColor: 'var(--color-primary)' }} />}
          </div>
        </div>
      </div>
      {isSpinning && <p className="text-sm text-primary font-bold animate-pulse" style={{ fontFamily: 'var(--font-display)' }}>命运之轮转动中...</p>}
      {showResult && finalCard && (
        <div className="flex gap-3 fade-in">
          <button type="button" onClick={handleRedraw}
            className="btn-secondary px-5 py-3 text-sm flex items-center gap-2">
            <IconRefreshCw className="w-4 h-4" />
            再抽一次
          </button>
          <button type="button" onClick={handleConfirm}
            className="btn-primary px-7 py-3 text-sm">
            就按这个来
          </button>
        </div>
      )}
    </div>
  );
}

// 距离选项（按心情选模式）
const DIST_OPTIONS = [
  { label: '不限', value: null },
  { label: '500m内', value: [0, 0.5] },
  { label: '1km内', value: [0, 1] },
  { label: '2km内', value: [0, 2] },
  { label: '3km内', value: [0, 3] },
  { label: '5km内', value: [0, 5] },
];

// 偏好微调组件
// variant: 'scenario'（按心情选）显示价格+距离，'explore'（探索未知）显示价格+菜系口味
function PreferenceTuner({ variant, priceRange, onPriceRangeChange, tags, onTagsChange, distRange, onDistRangeChange }) {
  const toggleTag = (tag) => {
    if (tags.includes(tag)) {
      onTagsChange(tags.filter(t => t !== tag));
    } else {
      onTagsChange([...tags, tag]);
    }
  };

  const [pMin, pMax] = priceRange;
  const minPct = ((pMin - PRICE_MIN) / (PRICE_MAX - PRICE_MIN)) * 100;
  const maxPct = ((pMax - PRICE_MIN) / (PRICE_MAX - PRICE_MIN)) * 100;

  const handlePMinChange = (e) => {
    const val = Math.min(Number(e.target.value), pMax - PRICE_STEP);
    onPriceRangeChange([val, pMax]);
  };
  const handlePMaxChange = (e) => {
    const val = Math.max(Number(e.target.value), pMin + PRICE_STEP);
    onPriceRangeChange([pMin, val]);
  };

  const priceLabel = pMin === PRICE_MIN && pMax === PRICE_MAX
    ? '不限'
    : pMax === PRICE_MAX
      ? `${pMin}元以上`
      : `${pMin}-${pMax}元`;

  return (
    <div className="outline-card p-5 mt-5 slide-up" style={{ animationDelay: '200ms', animationFillMode: 'both' }}>
      <div className="flex items-center gap-2 mb-4">
        <Mascot mood="think" size={28} float={false} />
        <span className="text-sm font-extrabold text-text" style={{ fontFamily: 'var(--font-display)' }}>偏好微调</span>
        <span className="text-xs text-text-muted">（可选）</span>
      </div>

      {/* 价格范围 - 双向滑动条 */}
      <div className="mb-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-text-secondary font-bold">价格范围</p>
          <span className="text-xs font-extrabold text-primary px-2 py-0.5 bg-primary/10 rounded-full border-2 border-ink" style={{ borderColor: 'var(--color-ink)', fontFamily: 'var(--font-num)' }}>{priceLabel}</span>
        </div>
        <div className="relative h-6 flex items-center">
          <div className="absolute inset-x-0 h-2 rounded-full bg-bg-soft border-2 border-ink" style={{ borderColor: 'var(--color-ink)' }} />
          <div className="absolute h-2 rounded-full bg-primary border-2 border-ink" style={{ left: `${minPct}%`, right: `${100 - maxPct}%`, borderColor: 'var(--color-ink)' }} />
          <input type="range" min={PRICE_MIN} max={PRICE_MAX} step={PRICE_STEP} value={pMin}
            onChange={handlePMinChange}
            className="range-thumb absolute inset-x-0 w-full appearance-none bg-transparent pointer-events-none" />
          <input type="range" min={PRICE_MIN} max={PRICE_MAX} step={PRICE_STEP} value={pMax}
            onChange={handlePMaxChange}
            className="range-thumb absolute inset-x-0 w-full appearance-none bg-transparent pointer-events-none" />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] text-text-muted font-bold">¥0</span>
          <span className="text-[10px] text-text-muted font-bold">¥200+</span>
        </div>
      </div>

      {/* scenario 模式：距离选项 */}
      {variant === 'scenario' && (
        <div className="mb-5">
          <p className="text-xs text-text-secondary mb-2 font-bold">距离范围</p>
          <div className="flex flex-wrap gap-2">
            {DIST_OPTIONS.map(opt => {
              const isDefault = distRange[0] === 0 && distRange[1] === 5;
              const isSelected = opt.value === null
                ? isDefault
                : (!isDefault && distRange[0] === opt.value[0] && distRange[1] === opt.value[1]);
              return (
                <button key={opt.label} type="button"
                  onClick={() => onDistRangeChange(opt.value || [0, 5])}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border-2 ${
                    isSelected
                      ? 'text-white shadow-[2px_2px_0_var(--color-ink)] -translate-x-0.5 -translate-y-0.5'
                      : 'bg-white text-text-secondary hover:bg-primary/10'
                  }`}
                  style={isSelected ? { backgroundColor: 'var(--color-primary)', borderColor: 'var(--color-ink)', fontFamily: 'var(--font-display)' } : { borderColor: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* explore 模式：美食分类标签 */}
      {variant === 'explore' && (
        <div>
          <p className="text-xs text-text-secondary mb-3 font-bold">美食分类</p>
          <div className="flex flex-wrap gap-2">
            {TASTE_TAG_GROUPS.flatMap(group => group.tags).map(({ label, icon }) => {
              const isTagSelected = tags.includes(label);
              return (
                <button key={label} type="button" onClick={() => toggleTag(label)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all border-2 flex items-center gap-1.5 ${
                    isTagSelected
                      ? 'text-white shadow-[2px_2px_0_var(--color-ink)] -translate-x-0.5 -translate-y-0.5'
                      : 'bg-white text-text-secondary hover:bg-primary/10'
                  }`}
                  style={isTagSelected ? { backgroundColor: 'var(--color-primary)', borderColor: 'var(--color-ink)', fontFamily: 'var(--font-display)' } : { borderColor: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>
                  <EmojiToIcon emoji={icon} size={14} />
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SoloInput({ onSearch, onFortune, isLoading }) {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [drawnCard, setDrawnCard] = useState(null);
  const [priceRange, setPriceRange] = useState([PRICE_MIN, PRICE_MAX]);
  const [distRange, setDistRange] = useState([0, 5]);
  const [selectedTags, setSelectedTags] = useState([]);
  const soloModes = getSoloModes();
  const categories = getSoloModeCategories();

  const handleSelectCategory = (cat) => {
    setSelectedCategory(cat.key);
    if (cat.key === 'fortune') setDrawnCard(null);
  };
  const handleSelectMode = (modeKey) => {
    const hasPriceFilter = priceRange[0] !== PRICE_MIN || priceRange[1] !== PRICE_MAX;
    const hasDistFilter = distRange[0] !== 0 || distRange[1] !== 5;
    const prefs = {
      priceRange: hasPriceFilter ? priceRange : null,
      distRange: selectedCategory === 'scenario' && hasDistFilter ? distRange : null,
      preferences: selectedCategory === 'explore' && selectedTags.length > 0 ? selectedTags : null,
    };
    const modeLabel = soloModes[modeKey]?.label || modeKey;
    trackModeSelect(modeKey, modeLabel);
    onSearch(modeKey, '', prefs);
  };
  const handleBackToCategories = () => { setSelectedCategory(null); setDrawnCard(null); };
  const getModesByCategory = (categoryKey) => Object.entries(soloModes).filter(([_, mode]) => mode.category === categoryKey);
  const handleCardDrawn = (card) => { setDrawnCard(card); onFortune(card); };

  // 今日运势不显示偏好微调
  const showPreferenceTuner = selectedCategory && selectedCategory !== 'fortune' && !drawnCard;

  return (
    <div className="relative max-w-2xl mx-auto px-6">
      {/* 背景漂浮装饰 */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <FoodDecor type="noodle" size={24} className="absolute left-[4%] top-[8%] opacity-25 float-animation hidden sm:block" style={{ animationDelay: '0.5s' }} />
        <FoodDecor type="chili" size={20} className="absolute right-[6%] top-[14%] opacity-25 float-animation hidden sm:block" style={{ animationDelay: '1.4s' }} />
        <FoodDecor type="egg" size={22} className="absolute left-[8%] top-[60%] opacity-25 float-animation hidden md:block" style={{ animationDelay: '2.1s' }} />
        <FoodDecor type="sparkle" size={16} className="absolute right-[10%] top-[70%] opacity-40 float-animation" style={{ animationDelay: '0.8s' }} />
      </div>

      <div className="relative mb-4">
        {!selectedCategory ? (
          <div>
            <div className="grid grid-cols-3 gap-4 fade-in">
              {categories.map((cat, i) => (
                <button key={cat.key} type="button" onClick={() => handleSelectCategory(cat)}
                  className="outline-card p-6 text-center flex flex-col items-center gap-3 slide-up"
                  style={{ animationDelay: `${i * 100}ms`, animationFillMode: 'both' }}>
                  <div className="relative w-14 h-14 rounded-2xl border-2 border-ink flex items-center justify-center shadow-[3px_3px_0_var(--color-ink)]" style={{ borderColor: 'var(--color-ink)', background: i === 0 ? 'var(--color-primary)' : i === 1 ? 'var(--color-secondary)' : 'var(--color-accent)' }}>
                    <EmojiToIcon emoji={cat.icon} size={28} className="text-white" />
                  </div>
                  <span className="text-sm font-extrabold text-text" style={{ fontFamily: 'var(--font-display)' }}>{cat.label}</span>
                  <span className="text-xs text-text-muted text-center leading-relaxed">{cat.description}</span>
                </button>
              ))}
            </div>

            {/* 面仔碎碎念 */}
            <div className="mt-4">
              <MascotTip />
            </div>

            {/* 装饰食物小插图 */}
            <FoodBanner />
          </div>
        ) : selectedCategory === 'fortune' && !drawnCard ? (
          <div className="scale-in">
            <button type="button" onClick={handleBackToCategories} className="text-primary text-sm font-bold flex items-center gap-1.5 transition-all hover:gap-2.5 mb-6" style={{ fontFamily: 'var(--font-display)' }}>
              <IconChevronLeft className="w-4 h-4" /> 返回
            </button>
            <FortuneSlotMachine onCardDrawn={handleCardDrawn} />
          </div>
        ) : (
          <div className="scale-in">
            <button type="button" onClick={handleBackToCategories} className="text-primary text-sm font-bold flex items-center gap-1.5 transition-all hover:gap-2.5 mb-6" style={{ fontFamily: 'var(--font-display)' }}>
              <IconChevronLeft className="w-4 h-4" /> 返回分类
            </button>
            <div className="grid grid-cols-2 gap-4">
              {getModesByCategory(selectedCategory).map(([key, mode]) => (
                <button key={key} type="button" onClick={() => handleSelectMode(key)} disabled={isLoading}
                  className="outline-card p-5 flex items-center gap-4 text-left disabled:opacity-50">
                  <div className="relative w-12 h-12 rounded-xl border-2 border-ink flex items-center justify-center shadow-[2px_2px_0_var(--color-ink)] flex-shrink-0" style={{ borderColor: 'var(--color-ink)', background: 'var(--color-bg-soft)' }}>
                    <EmojiToIcon emoji={mode.icon} size={24} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-extrabold truncate text-text" style={{ fontFamily: 'var(--font-display)' }}>{mode.label}</p>
                    <p className="text-xs truncate text-text-muted mt-0.5">{mode.description}</p>
                  </div>
                  {isLoading && <IconLoader2 className="w-5 h-5 animate-spin text-primary flex-shrink-0" />}
                </button>
              ))}
            </div>
            {showPreferenceTuner && (
              <PreferenceTuner
                variant={selectedCategory}
                priceRange={priceRange}
                onPriceRangeChange={setPriceRange}
                tags={selectedTags}
                onTagsChange={setSelectedTags}
                distRange={distRange}
                onDistRangeChange={setDistRange}
              />
            )}
          </div>
        )}

        {isLoading && (
          <LoadingOverlay 
            message="正在为你挑餐厅..." 
            subMessage={drawnCard ? `${drawnCard.label}好运加持中` : ''} 
          />
        )}
      </div>
    </div>
  );
}
import { useState, useEffect, useRef } from 'react';
import ResultCard from './ResultCard';
import MapView from './MapView';
import Mascot from './Mascot';
import { FoodDecor } from './Mascot';
import LoadingOverlay from './LoadingOverlay';
import { 
  IconArrowLeft, IconRefreshCw, IconMapPin, IconVote, IconDice, 
  IconThinking, IconBan, IconWarning, IconSparkle, IconSparkles,
  IconUtensils, IconWallet, IconChart, IconCheck, IconLightbulb
} from './icons/FancyIcons';

export default function ResultList({
  results,
  onBack,
  onRefresh,
  isLoading,
  isExploreMode = false,
  isSolo = false,
  location,
  onVote,
  showVote = true,
  cuisineVote,
  memberCount,
  conflicts,
  emptySuggestions = [],
  onApplySuggestion,
  onFeedback,
  budgetCompromise
}) {
  const [showMap, setShowMap] = useState(false);
  // 手机端横滑缩略导航的当前选中索引
  const [selectedIndex, setSelectedIndex] = useState(0);
  const thumbRefs = useRef([]);

  // 换一批/重新搜索后重置到第一家
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  // 选中项变化时，自动滚动缩略卡到可视区中间
  useEffect(() => {
    thumbRefs.current[selectedIndex]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [selectedIndex]);

  // 缩略卡评分：与 ResultCard 的 displayScore 逻辑一致
  const thumbScore = (r) => {
    const s = r?.matchScore;
    return (typeof s === 'number' && !isNaN(s)) ? Math.round(s * 10) / 10 : 75;
  };

  const getSuggestionIcon = (type) => {
    switch (type) {
      case 'similar_cuisine': return <IconUtensils className="w-4 h-4" />;
      case 'expand_distance': return <IconMapPin className="w-4 h-4" />;
      case 'relax_budget': return <IconWallet className="w-4 h-4" />;
      case 'fewer_allergies': return <IconBan className="w-4 h-4" />;
      case 'show_all': return <IconSparkles className="w-4 h-4" />;
      default: return <IconSparkle className="w-4 h-4" />;
    }
  };

  if (isLoading) {
    return <LoadingOverlay />;
  }

  if (!results || results.length === 0) {
    return (
      <div className="max-w-lg mx-auto px-4 sm:px-6 text-center py-12 fade-in relative">
        <div className="relative inline-block mb-4">
          <Mascot mood="thinking" size={96} />
          <FoodDecor type="star" size={14} className="pointer-events-none absolute -top-2 -left-3 float-animation opacity-60" style={{ animationDelay: '0.5s' }} />
          <FoodDecor type="sparkle" size={12} className="pointer-events-none absolute top-2 -right-3 float-animation opacity-60" style={{ animationDelay: '1.1s' }} />
        </div>
        <h3 className="text-xl font-bold text-text mb-2">{'附近没找到合适的餐厅'}</h3>
        <p className="text-text-secondary text-sm mb-6">{'试试调整一下条件？'}</p>
        
        {emptySuggestions && emptySuggestions.length > 0 && (
          <div className="mb-6 space-y-2">
            {emptySuggestions.map((suggestion, i) => (
              <button
                key={suggestion.id}
                onClick={() => onApplySuggestion && onApplySuggestion(suggestion)}
                className="w-full flat-card p-3 text-left flex items-center gap-3 hover:bg-bg-secondary transition-colors animate-slide-up"
                style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'both' }}
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                  {getSuggestionIcon(suggestion.type)}
                </div>
                <span className="text-sm text-text flex-1">{suggestion.text}</span>
                <span className="text-primary text-sm font-medium">{'试试→'}</span>
              </button>
            ))}
          </div>
        )}
        
        <button onClick={onBack}
          className="btn-primary px-5 py-2.5 text-sm">
          {'修改偏好'}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6">
      <div className="flex items-center justify-between mb-5 fade-in">
        <button onClick={onBack} className="text-text-secondary text-sm font-medium flex items-center gap-1 hover:text-primary transition-colors">
          <IconArrowLeft className="w-4 h-4" /> {'返回修改'}
        </button>
        {!isExploreMode && (
          <button onClick={onRefresh} className="text-text-secondary text-sm font-medium flex items-center gap-1 hover:text-primary transition-colors">
            <IconRefreshCw className="w-4 h-4" /> {'换一批'}
          </button>
        )}
      </div>

      {!isExploreMode && conflicts && conflicts.length > 0 && (
        <div className="mb-4 conflict-warning animate-slide-up">
          <p className="text-text font-bold mb-1.5" style={{ fontFamily: 'var(--font-display)' }}>{'检测到偏好冲突'}</p>
          {conflicts.map((c, i) => (
            <p key={i} className="text-text-secondary text-xs mt-1 leading-relaxed">
              <span className="inline-flex align-middle mr-1 text-accent-dark">
                {c.type === 'hard' ? <IconBan size={16} /> : <IconWarning size={16} />}
              </span>
              {c.members[0]}想吃{c.preference} ↔ {c.members[1]}不吃{c.allergy}
              <span className="text-text-muted"> → {c.resolution}</span>
            </p>
          ))}
        </div>
      )}

      {/* 预算折中提示卡 */}
      {!isExploreMode && budgetCompromise && (
        <div className="mb-4 p-3 rounded-xl border-2 animate-slide-up"
          style={{
            borderColor: 'var(--color-ink)',
            background: budgetCompromise.type === 'empty_intersection'
              ? 'rgba(245,158,11,0.08)'
              : budgetCompromise.type === 'narrow_intersection'
                ? 'rgba(255,122,89,0.06)'
                : 'rgba(124,92,255,0.06)',
          }}>
          <div className="flex items-start gap-2.5 text-sm" style={{ fontFamily: 'var(--font-display)' }}>
            <span className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center bg-white border-2 text-xs"
              style={{ borderColor: 'var(--color-ink)' }}>
              {budgetCompromise.type === 'empty_intersection' ? (
                <IconWarning className="w-3 h-3" />
              ) : budgetCompromise.type === 'narrow_intersection' ? (
                <IconChart className="w-3 h-3" />
              ) : (
                <IconCheck className="w-3 h-3" />
              )}
            </span>
            <span className="text-text-secondary leading-relaxed font-medium">{budgetCompromise.text}</span>
          </div>
        </div>
      )}

      {!isExploreMode && (
        <div className={`mb-5 ${showVote ? 'flex gap-3' : ''} animate-slide-up`}>
          <button onClick={() => setShowMap(!showMap)}
            className={`${showVote ? 'flex-1' : 'w-full'} btn-secondary py-2.5 text-sm font-medium flex items-center justify-center gap-2 ${showMap ? 'text-text' : ''}`}>
            <IconMapPin className="w-4 h-4" />
            {showMap ? '收起地图' : '在地图上查看'}
          </button>
          {showVote && (
            <button onClick={onVote}
              className="btn-primary flex-1 py-2.5 text-sm font-medium flex items-center justify-center gap-2">
              <IconVote className="w-4 h-4" /> {'发起投票'}
            </button>
          )}
        </div>
      )}

      {showMap && !isExploreMode && (
        <div className="mb-5 scale-in fancy-card p-3 overflow-hidden">
          <MapView restaurants={results} center={location} />
        </div>
      )}

      {isExploreMode ? (
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-sm font-medium mb-5 fade-in">
            {results[0]?.exploreMode === 'fresh' && <IconSparkle size={18} />}
            <span>{`${results[0]?.timeContext || ''}探索`}</span>
          </div>
          <div className="slide-up">
            <ResultCard restaurant={results[0]} showExploreMessage={true} isSolo={isSolo} onFeedback={onFeedback} />
          </div>
          <div className="mt-6 flex justify-center gap-3 fade-in">
            <button onClick={onRefresh}
              className="btn-explore flex flex-col items-center justify-center gap-1 leading-none"
              style={{ width: '88px', height: '88px', borderRadius: '50%', padding: 0 }}>
              <span className="font-extrabold text-sm">{'再来一个'}</span>
              <span className="w-7 h-7 flex items-center justify-center">
                <IconDice className="w-full h-full" />
              </span>
            </button>
          </div>
        </div>
      ) : (
        <div>
          {cuisineVote && cuisineVote.consensusLevel !== 'none' && (
            <div className="bg-primary/10 text-text p-3.5 rounded-xl text-sm mb-4 fade-in">
              {cuisineVote.consensusLevel === 'strong' && (
                <span>{`${memberCount} 人中有 ${cuisineVote.topCount} 人想吃${cuisineVote.topCuisine} → 优先推荐${cuisineVote.topCuisine}店`}</span>
              )}
              {cuisineVote.consensusLevel === 'split' && cuisineVote.tieCuisines && cuisineVote.tieCuisines.length >= 2 && (
                <span>{`${cuisineVote.tieCuisines[0]} ${cuisineVote.topCount}票 : ${cuisineVote.topCount}票 ${cuisineVote.tieCuisines[1]} → 为你混合推荐两种选择`}</span>
              )}
              {cuisineVote.consensusLevel === 'diverse' && (
                <span>{'大家口味各不相同 → 为你综合推荐'}</span>
              )}
            </div>
          )}
          <p className="text-xs text-text-muted mb-4">{`为你找到 ${results.length} 家匹配的餐厅`}</p>

          {/* 手机端：横滑缩略导航 + 单卡详情 */}
          <div className="sm:hidden">
            <div className="-mx-4 px-4 overflow-x-auto flex gap-3 pb-2 snap-x snap-mandatory">
              {results.map((r, i) => (
                <button
                  key={r.id}
                  ref={el => { thumbRefs.current[i] = el; }}
                  onClick={() => setSelectedIndex(i)}
                  className="snap-start shrink-0 w-40 text-left rounded-xl border-2 bg-white overflow-hidden transition-all"
                  style={{ borderColor: i === selectedIndex ? 'var(--color-primary)' : 'var(--color-ink)' }}>
                  <div className="h-20 w-full bg-bg-soft flex items-center justify-center">
                    {r.photos?.[0]?.url
                      ? <img src={r.photos[0].url} alt={r.name} className="w-full h-full object-cover" loading="lazy" />
                      : <span className="text-text-muted text-xs">无图</span>}
                  </div>
                  <div className="p-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-extrabold text-primary">{i + 1}</span>
                      <span className="text-xs font-bold text-text truncate flex-1">{r.name}</span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] text-text-secondary truncate">{r.cuisine} · ¥{r.price}</span>
                      <span className="text-[11px] font-extrabold text-secondary flex-shrink-0">{thumbScore(r)}分</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {results[selectedIndex] && (
              <ResultCard restaurant={results[selectedIndex]} isSolo={isSolo} onFeedback={onFeedback} />
            )}
          </div>

          {/* 桌面端：竖排（原样保留） */}
          <div className="hidden sm:block">
            {results.map((restaurant, i) => (
              <div key={restaurant.id} className="slide-up" style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'both' }}>
                <ResultCard restaurant={restaurant} isSolo={isSolo} onFeedback={onFeedback} />
              </div>
            ))}
          </div>

          {/* 低分/高折中场景协商建议卡：Tier 3 占比高或最低成员分偏低时提示 */}
          {(() => {
            if (!conflicts || conflicts.length === 0 || results.length === 0) return null;
            const tier3OrMore = results.filter(r => (r.solutionTier || 1) >= 3).length;
            const lowestMin = Math.min(...results.map(r => typeof r._groupMin === 'number' ? r._groupMin : 100));
            const needSuggest = tier3OrMore >= 2 || lowestMin < 55;
            if (!needSuggest) return null;

            const hasHard = conflicts.some(c => c.type === 'hard');
            return (
              <div className="mt-6 p-4 rounded-xl border-2 space-y-2 animate-slide-up"
                style={{
                  borderColor: 'var(--color-ink)',
                  background: 'rgba(245,158,11,0.06)',
                }}>
                <div className="flex items-start gap-2.5 text-sm font-bold text-text-secondary mb-1" style={{ fontFamily: 'var(--font-display)' }}>
                  <span className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center bg-white border-2" style={{ borderColor: 'var(--color-ink)' }}>
                    <IconLightbulb className="w-3.5 h-3.5 text-primary" />
                  </span>
                  <span>系统有话要说：当前推荐多为折中方案</span>
                </div>
                <ul className="space-y-1.5 pl-7 text-xs text-text-secondary" style={{ fontFamily: 'var(--font-display)' }}>
                  {conflicts.map((c, i) => (
                    <li key={i} className="leading-relaxed">
                      · <strong>{c.members?.[0]}（想吃{c.preference}）</strong> 与 <strong>{c.members?.[1]}（不吃{c.allergy}）</strong>
                      {hasHard ? '是硬冲突，建议你们线下确认：忌口方能否松口（如微辣可以），或偏好方是否接受折中菜系' : '是软冲突，可通过协商放宽'}
                    </li>
                  ))}
                  <li className="leading-relaxed">
                    · 如果<strong>忌口是医嘱/过敏不可妥协</strong>，但<strong>偏好方不愿让步</strong> → 可以考虑
                    <strong>分组就餐</strong>：各自选满意的餐厅，吃完再一起活动。
                  </li>
                </ul>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

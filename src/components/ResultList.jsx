import { useState } from 'react';
import ResultCard from './ResultCard';
import MapView from './MapView';
import Mascot from './Mascot';
import { FoodDecor } from './Mascot';
import LoadingOverlay from './LoadingOverlay';
import { useTranslation } from '../i18n';
import { 
  IconArrowLeft, IconRefreshCw, IconMapPin, IconVote, IconDice, 
  IconThinking, IconBan, IconWarning, IconSparkle, IconSparkles,
  IconUtensils, IconWallet
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
  onFeedback
}) {
  const { t } = useTranslation();
  const [showMap, setShowMap] = useState(false);

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
      <div className="max-w-lg mx-auto px-6 text-center py-12 fade-in relative">
        <div className="relative inline-block mb-4">
          <Mascot mood="thinking" size={96} />
          <FoodDecor type="star" size={14} className="pointer-events-none absolute -top-2 -left-3 float-animation opacity-60" style={{ animationDelay: '0.5s' }} />
          <FoodDecor type="sparkle" size={12} className="pointer-events-none absolute top-2 -right-3 float-animation opacity-60" style={{ animationDelay: '1.1s' }} />
        </div>
        <h3 className="text-xl font-bold text-text mb-2">{t('resultList.empty')}</h3>
        <p className="text-text-secondary text-sm mb-6">{t('resultList.emptyHint')}</p>
        
        {emptySuggestions && emptySuggestions.length > 0 && (
          <div className="mb-6 space-y-2">
            {emptySuggestions.map((suggestion, i) => (
              <button
                key={suggestion.id}
                onClick={() => onApplySuggestion && onApplySuggestion(suggestion)}
                className="w-full fancy-card p-3 text-left flex items-center gap-3 hover:bg-bg-secondary transition-colors animate-slide-up"
                style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'both' }}
              >
                <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                  {getSuggestionIcon(suggestion.type)}
                </div>
                <span className="text-sm text-text flex-1">{suggestion.text}</span>
                <span className="text-primary text-sm font-medium">{t('resultList.tryAdjust')}</span>
              </button>
            ))}
          </div>
        )}
        
        <button onClick={onBack}
          className="btn-primary px-5 py-2.5 text-sm">
          {t('resultList.editPrefs')}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-6">
      <div className="flex items-center justify-between mb-5 fade-in">
        <button onClick={onBack} className="text-primary text-sm font-medium flex items-center gap-1">
          <IconArrowLeft className="w-4 h-4" /> {t('resultList.backEdit')}
        </button>
        {!isExploreMode && (
          <button onClick={onRefresh} className="text-primary text-sm font-medium flex items-center gap-1">
            <IconRefreshCw className="w-4 h-4" /> {t('resultList.refresh')}
          </button>
        )}
      </div>

      {!isExploreMode && conflicts && conflicts.length > 0 && (
        <div className="mb-4 conflict-warning animate-slide-up">
          <p className="text-error font-medium mb-1.5">{t('resultList.conflict')}</p>
          {conflicts.map((c, i) => (
            <p key={i} className="text-error/70 text-xs mt-1 leading-relaxed">
              <span className="inline-flex align-middle mr-1">
                {c.type === 'hard' ? <IconBan size={16} /> : <IconWarning size={16} />}
              </span>
              {c.members[0]}想吃{c.preference} ↔ {c.members[1]}不吃{c.allergy}
              <span className="text-error/50"> → {c.resolution}</span>
            </p>
          ))}
        </div>
      )}

      {!isExploreMode && (
        <div className={`mb-5 ${showVote ? 'flex gap-3' : ''} animate-slide-up`}>
          <button onClick={() => setShowMap(!showMap)}
            className={`${showVote ? 'flex-1' : 'w-full'} btn-secondary py-2.5 text-sm font-medium flex items-center justify-center gap-2 ${showMap ? 'text-text' : ''}`}>
            <IconMapPin className="w-4 h-4" />
            {showMap ? t('resultList.collapseMap') : t('resultList.showMap')}
          </button>
          {showVote && (
            <button onClick={onVote}
              className="btn-primary flex-1 py-2.5 text-sm font-medium flex items-center justify-center gap-2">
              <IconVote className="w-4 h-4" /> {t('resultList.startVote')}
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
            <span>{t('resultList.explore', { time: results[0]?.timeContext || '' })}</span>
          </div>
          <div className="slide-up">
            <ResultCard restaurant={results[0]} showExploreMessage={true} isSolo={isSolo} onFeedback={onFeedback} />
          </div>
          <div className="mt-6 flex justify-center gap-3 fade-in">
            <button onClick={onRefresh}
              className="btn-explore flex flex-col items-center justify-center gap-1 leading-none"
              style={{ width: '88px', height: '88px', borderRadius: '50%', padding: 0 }}>
              <span className="font-extrabold text-sm">{t('resultList.oneMore')}</span>
              <span className="w-7 h-7 flex items-center justify-center">
                <IconDice className="w-full h-full" />
              </span>
            </button>
          </div>
        </div>
      ) : (
        <div>
          {cuisineVote && cuisineVote.consensusLevel !== 'none' && (
            <div className="bg-primary/10 text-primary p-3.5 rounded-xl text-sm mb-4 fade-in">
              {cuisineVote.consensusLevel === 'strong' && (
                <span>{t('resultList.voteTop', { count: memberCount, topCount: cuisineVote.topCount, cuisine: cuisineVote.topCuisine })}</span>
              )}
              {cuisineVote.consensusLevel === 'split' && cuisineVote.tieCuisines && cuisineVote.tieCuisines.length >= 2 && (
                <span>{t('resultList.voteTie', { a: cuisineVote.tieCuisines[0], topCount: cuisineVote.topCount, b: cuisineVote.tieCuisines[1] })}</span>
              )}
              {cuisineVote.consensusLevel === 'diverse' && (
                <span>{t('resultList.voteMixed')}</span>
              )}
            </div>
          )}
          <p className="text-xs text-text-muted mb-4">{t('resultList.found', { count: results.length })}</p>
          {results.map((restaurant, i) => (
            <div key={restaurant.id} className="slide-up" style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'both' }}>
              <ResultCard restaurant={restaurant} isSolo={isSolo} onFeedback={onFeedback} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

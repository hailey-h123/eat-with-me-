import { useState, useEffect } from 'react';
import {
  IconMapPin, IconClock, IconPhone, IconChevronRight, IconChevronLeft, IconStar,
  IconNavigation, IconLightbulb, IconCheck, IconCross, IconHalfCheck,
  IconThumbsUp, IconThumbsDown, IconBookmark, IconCheckCircle,
  IconPerfectFusion, IconFlavorFusion, IconStyleFusion
} from './icons/FancyIcons';
import { FoodDecor } from './Mascot';
import Lightbox from './Lightbox';
import { hasLiked, hasDisliked, addLike, addDislike, removeLike, removeDislike } from '../services/feedbackService';
import { isFavorited, toggleFavorite, isVisited, toggleVisited } from '../services/historyService';
import { trackFavorite, trackNavigate } from '../services/analyticsService';
import { useTranslation } from '../i18n';

const GENERIC_TAGS = new Set([
  '餐饮服务', '餐饮相关场所', '餐饮相关', '餐饮', '餐饮服务场所',
  '餐厅', '餐馆', '饭馆', '饮食', '食品', '美食',
]);

function filterTags(tags, restaurantName = '') {
  if (!tags || tags.length === 0) return [];
  const nameWithoutBrackets = (restaurantName || '').replace(/[\(\)（）].*/, '');
  return tags.filter(tag => {
    if (GENERIC_TAGS.has(tag)) return false;
    if (nameWithoutBrackets.includes(tag) || tag.includes(nameWithoutBrackets)) return false;
    return true;
  });
}

export default function ResultCard({ restaurant, showExploreMessage = false, isSolo = false, onFeedback }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [liked, setLiked] = useState(false);
  const [disliked, setDisliked] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [visited, setVisited] = useState(false);
  // 多图轮播状态：currentIndex 直接指向 photos 原始数组的索引
  const photos = restaurant.photos || [];
  const [currentIndex, setCurrentIndex] = useState(0);
  // 记录加载失败的图片索引，自动跳到下一张可用的
  const [failedPhotos, setFailedPhotos] = useState(new Set());

  useEffect(() => {
    if (restaurant?.id) {
      setLiked(hasLiked(restaurant.id));
      setDisliked(hasDisliked(restaurant.id));
      setFavorited(isFavorited(restaurant.id));
      setVisited(isVisited(restaurant.id));
    }
  }, [restaurant?.id]);

  const handleLike = (e) => {
    e.stopPropagation();
    if (liked) {
      setLiked(false);
      removeLike(restaurant.id);
      return;
    }
    setLiked(true);
    setDisliked(false);
    addLike(restaurant);
    if (onFeedback) onFeedback('like', restaurant);
  };

  const handleDislike = (e) => {
    e.stopPropagation();
    if (disliked) {
      setDisliked(false);
      removeDislike(restaurant.id);
      return;
    }
    setDisliked(true);
    setLiked(false);
    addDislike(restaurant);
    if (onFeedback) onFeedback('dislike', restaurant);
  };

  const handleFavorite = (e) => {
    e.stopPropagation();
    const nowFav = toggleFavorite(restaurant);
    setFavorited(nowFav);
    trackFavorite(nowFav ? 'add' : 'remove', restaurant.cuisine || '');
  };

  const handleVisit = (e) => {
    e.stopPropagation();
    const nowVisited = toggleVisited(restaurant);
    setVisited(nowVisited);
  };

  // 从 currentIndex 计算实际可用索引（向前搜索）
  const getEffectiveIndex = () => {
    for (let i = currentIndex; i < photos.length; i++) {
      if (!failedPhotos.has(i)) return i;
    }
    for (let i = 0; i < currentIndex; i++) {
      if (!failedPhotos.has(i)) return i;
    }
    return -1;
  };

  // 当前可用的图片索引
  const effectiveIndex = getEffectiveIndex();
  const hasAvailablePhoto = effectiveIndex >= 0;
  const currentPhoto = hasAvailablePhoto ? photos[effectiveIndex] : null;
  const currentUrl = currentPhoto?.url || null;
  const totalCount = photos.length;
  const showCarousel = hasAvailablePhoto && totalCount > 1;

  const handleNavigate = (e) => {
    e.stopPropagation();
    trackNavigate(restaurant.name || '');
    if (restaurant.lng && restaurant.lat) {
      window.open(`https://uri.amap.com/marker?position=${restaurant.lng},${restaurant.lat}&name=${encodeURIComponent(restaurant.name)}&coordinate=gaode&callnative=1`, '_blank');
    } else {
      window.open(`https://www.amap.com/search?query=${encodeURIComponent(restaurant.name)}`, '_blank');
    }
  };

  const getScoreStyle = (score) => {
    const safeScore = typeof score === 'number' && !isNaN(score) ? score : 75;
    if (safeScore >= 85) return 'text-secondary';
    if (safeScore >= 70) return 'text-primary';
    return 'text-text-secondary';
  };

  const displayScore = (() => {
    const s = restaurant.matchScore;
    if (typeof s !== 'number' || isNaN(s)) return 75;
    return Math.round(s * 10) / 10;
  })();

  const filteredTags = [...new Set(filterTags(restaurant.tags, restaurant.name))].slice(0, 3);
  const featureTags = (restaurant.featureTags || []).slice(0, 2);

  // 图片加载失败处理：标记当前图片失败，自动跳到下一张可用的
  const handleImgError = () => {
    if (effectiveIndex >= 0) {
      setFailedPhotos(prev => new Set([...prev, effectiveIndex]));
    }
  };

  // 轮播：向后翻（跳转到下一个可用索引）
  const handleNextPhoto = (e) => {
    e.stopPropagation();
    setCurrentIndex(prev => {
      let next = prev;
      const max = photos.length;
      for (let attempt = 0; attempt < max; attempt++) {
        next = (next + 1) % max;
        if (!failedPhotos.has(next)) break;
      }
      return next;
    });
  };

  // 轮播：向前翻（跳转到上一个可用索引）
  const handlePrevPhoto = (e) => {
    e.stopPropagation();
    setCurrentIndex(prev => {
      let next = prev;
      const max = photos.length;
      for (let attempt = 0; attempt < max; attempt++) {
        next = next - 1;
        if (next < 0) next = max - 1;
        if (!failedPhotos.has(next)) break;
      }
      return next;
    });
  };

  // Lightbox 控制
  const handleOpenLightbox = (e) => {
    e.stopPropagation();
    setLightboxOpen(true);
  };
  const handleCloseLightbox = () => setLightboxOpen(false);
  const handleLightboxPrev = () => {
    setCurrentIndex(prev => {
      let n = prev;
      for (let i = 0; i < photos.length; i++) {
        n = n - 1;
        if (n < 0) n = photos.length - 1;
        if (!failedPhotos.has(n)) break;
      }
      return n;
    });
  };
  const handleLightboxNext = () => {
    setCurrentIndex(prev => {
      let n = prev;
      for (let i = 0; i < photos.length; i++) {
        n = (n + 1) % photos.length;
        if (!failedPhotos.has(n)) break;
      }
      return n;
    });
  };

  return (
    <>
    <div
      className="fancy-card mb-4 cursor-pointer relative overflow-hidden"
      onClick={() => setExpanded(!expanded)}
    >
      {/* 卡片角落装饰小涂鸦（不挡点击） */}
      {!currentUrl && (
        <>
          <FoodDecor type="sparkle" size={16} className="pointer-events-none absolute top-3 right-3 opacity-40 z-10" />
          <FoodDecor type="egg" size={14} className="pointer-events-none absolute bottom-3 left-3 opacity-30 z-10" />
        </>
      )}

      {currentUrl && (
        <div className="relative w-full h-48 overflow-hidden group" style={{ borderBottom: '2.5px solid var(--color-ink)' }}>
          <img
            src={currentUrl}
            alt={restaurant.name}
            onError={handleImgError}
            onClick={handleOpenLightbox}
            className="w-full h-full object-cover cursor-zoom-in"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
          {!isSolo && (
          <span className={`absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-extrabold bg-white border-2.5 border-ink shadow-[3px_3px_0_var(--color-ink)] ${getScoreStyle(displayScore)}`}
            style={{ borderColor: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>
            {displayScore}
          </span>
          )}

          {/* 多图轮播控件 */}
          {showCarousel && (
            <>
              {/* 左右箭头 */}
              <button onClick={handlePrevPhoto}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 border-2 border-ink flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-[2px_2px_0_var(--color-ink)]"
                style={{ borderColor: 'var(--color-ink)' }}>
                <IconChevronLeft className="w-4 h-4 text-text" />
              </button>
              <button onClick={handleNextPhoto}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 border-2 border-ink flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-[2px_2px_0_var(--color-ink)]"
                style={{ borderColor: 'var(--color-ink)' }}>
                <IconChevronRight className="w-4 h-4 text-text" />
              </button>
              {/* 底部指示点 */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                {photos.map((_, i) => {
                  const isFailed = failedPhotos.has(i);
                  const isActive = i === effectiveIndex;
                  return (
                    <span key={i}
                      className={`w-1.5 h-1.5 rounded-full transition-all ${isFailed ? 'opacity-30' : ''}`}
                      style={{
                        backgroundColor: isActive ? 'var(--color-primary)' : 'rgba(255,255,255,0.6)',
                        border: '1px solid var(--color-ink)',
                      }} />
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      <div className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <h3 className="font-extrabold text-xl text-text pr-3" style={{ fontFamily: 'var(--font-display)' }}>{restaurant.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-text-secondary">{restaurant.cuisine}</span>
              <span className="text-text-muted">·</span>
              <span className="text-sm text-text-secondary">{t('result.perPerson', { price: restaurant.price })}</span>
            </div>
          </div>
          {!currentUrl && !isSolo && (
            <span className={`px-4 py-1.5 rounded-full text-xs font-extrabold flex-shrink-0 border-2.5 border-ink shadow-[3px_3px_0_var(--color-ink)] ${getScoreStyle(displayScore)}`}
              style={{ borderColor: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>
              {displayScore}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-text-secondary flex-wrap mb-4">
          <span className="flex items-center gap-1.5 tag-pill">
            <IconMapPin className="w-3 h-3" /> {t('result.walkMinutes', { minutes: restaurant.distance })}
          </span>
          <span className="flex items-center gap-1.5 tag-pill" style={{ background: 'rgba(255,201,60,0.15)', color: 'var(--color-accent-dark)' }}>
            <IconStar className="w-3 h-3" />
            {restaurant.rating}
          </span>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {filteredTags.map(tag => (
            <span key={tag} className="px-3 py-1 rounded-full text-xs font-bold bg-bg-soft text-text-secondary border-2 border-ink"
              style={{ borderColor: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>
              {tag}
            </span>
          ))}
          {featureTags.map(tag => (
            <span key={tag} className="px-3 py-1 rounded-full text-xs font-bold text-white border-2 border-ink shadow-[2px_2px_0_var(--color-ink)]"
              style={{ background: 'var(--color-secondary)', borderColor: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>
              {tag}
            </span>
          ))}
          {restaurant.soloFriendly >= 70 && (
            <span className="px-3 py-1 rounded-full text-xs font-bold text-white border-2 border-ink shadow-[2px_2px_0_var(--color-ink)]"
              style={{ background: 'var(--color-grass)', borderColor: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>
              {t('result.soloFriendly')}
            </span>
          )}
        </div>

        {showExploreMessage && (
          <div className="mt-4 space-y-3">
            <div className="sticky-note text-sm text-text font-bold flex items-start gap-2" style={{ fontFamily: 'var(--font-display)' }}>
              <IconLightbulb className="w-4 h-4 flex-shrink-0 mt-0.5 text-primary" />
              <span>{restaurant.exploreMessage}</span>
            </div>
            {restaurant.story && (
              <div className="p-4 bg-bg-soft rounded-xl text-sm text-text-secondary border-2 border-ink"
                style={{ borderColor: 'var(--color-ink)' }}>
                {restaurant.story}
              </div>
            )}
          </div>
        )}

        {(restaurant.reasons && restaurant.reasons.length > 0) && (
        <div className="mt-4 p-4 bg-bg-soft rounded-xl space-y-2 border-2 border-ink" style={{ borderColor: 'var(--color-ink)' }}>
          {restaurant.reasons.map((reason, index) => {
            let icon;
            let iconColor = '';
            let isDetail = false;
            let isFusionHeader = false;
            
            if (reason.type === 'fusion') {
              isFusionHeader = true;
              if (reason.fusionType === 'perfect') {
                icon = <IconPerfectFusion className="w-3 h-3" />;
                iconColor = 'text-secondary';
              } else if (reason.fusionType === 'flavor') {
                icon = <IconFlavorFusion className="w-3 h-3" />;
                iconColor = 'text-accent-dark';
              } else {
                icon = <IconStyleFusion className="w-3 h-3" />;
                iconColor = 'text-accent-dark';
              }
            } else if (reason.type === 'fusion-detail') {
              isDetail = true;
              if (reason.fusionType === 'perfect') {
                icon = <IconCheck className="w-3 h-3" />;
                iconColor = 'text-secondary';
              } else if (reason.fusionType === 'flavor') {
                icon = <IconHalfCheck className="w-3 h-3" />;
                iconColor = 'text-accent-dark';
              } else {
                icon = <IconHalfCheck className="w-3 h-3" />;
                iconColor = 'text-accent-dark';
              }
            } else if (reason.type === 'group') {
              const satisfied = reason.satisfiedCount || 0;
              const total = reason.totalCount || 1;
              if (satisfied === total) {
                icon = <IconCheck className="w-3 h-3" />;
                iconColor = 'text-secondary';
              } else if (satisfied === 0) {
                icon = <IconCross className="w-3 h-3" />;
                iconColor = 'text-text-muted';
              } else {
                icon = <IconHalfCheck className="w-3 h-3" />;
                iconColor = 'text-accent-dark';
              }
            } else if (reason.type === 'match') {
              icon = <IconCheck className="w-3 h-3" />;
              iconColor = 'text-secondary';
            } else if (reason.type === 'partial') {
              icon = <IconHalfCheck className="w-3 h-3" />;
              iconColor = 'text-accent-dark';
            } else {
              icon = <IconCross className="w-3 h-3" />;
              iconColor = 'text-text-muted';
            }
            
            if (isDetail) {
              const prefix = reason.memberName ? `${reason.memberName}：` : '';
              return (
                <div 
                  key={index} 
                  className="text-sm flex items-start gap-2 text-text pl-5"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {icon && (
                    <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center bg-white border-2 border-ink ${iconColor} text-[12px] leading-none`} style={{ borderColor: 'var(--color-ink)' }}>
                      {icon}
                    </span>
                  )}
                  <span className="leading-relaxed font-medium">
                    {prefix}{reason.text}
                  </span>
                </div>
              );
            }

            if (isFusionHeader) {
              return (
                <div 
                  key={index} 
                  className="text-sm flex items-start gap-2.5 text-text pt-1"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center bg-white border-2 border-ink ${iconColor} text-[12px] leading-none`} style={{ borderColor: 'var(--color-ink)' }}>
                    {icon}
                  </span>
                  <span className="leading-relaxed font-medium">{reason.text}</span>
                </div>
              );
            }
            
            return (
              <div 
                key={index} 
                className="text-sm flex items-start gap-2.5 text-text"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center bg-white border-2 border-ink ${iconColor} text-[12px] leading-none`} style={{ borderColor: 'var(--color-ink)' }}>
                  {icon}
                </span>
                <span className="leading-relaxed font-medium">{reason.text}</span>
              </div>
            );
          })}
        </div>
        )}

        <div className="mt-4 flex items-center justify-center text-text-muted text-xs font-bold" style={{ fontFamily: 'var(--font-display)' }}>
          <span className="hover:text-primary transition-colors">{expanded ? t('result.collapse') : t('result.expand')}</span>
          <IconChevronRight className={`w-4 h-4 ml-1 transition-all duration-300 ${expanded ? 'rotate-90 text-primary' : ''}`} />
        </div>

        <div className="mt-3 flex items-center justify-center gap-1.5 sm:gap-3 flex-wrap">
          <button
            onClick={handleFavorite}
            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-full transition-all text-xs font-medium"
            style={favorited ? {
              background: 'rgba(255,201,60,0.15)',
              color: '#F0A818',
            } : {
              color: '#A89F8E',
            }}
          >
            <IconBookmark className="w-4 h-4" filled={favorited} />
            <span className="hidden sm:inline">{favorited ? t('result.favorited') : t('result.favorite')}</span>
          </button>
          <div className="w-px h-4 hidden sm:block" style={{ background: '#FDE6C8' }} />
          <button
            onClick={handleVisit}
            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-full transition-all text-xs font-medium"
            style={visited ? {
              background: 'rgba(107,203,119,0.15)',
              color: '#6BCB77',
            } : {
              color: '#A89F8E',
            }}
          >
            <IconCheckCircle className="w-4 h-4" filled={visited} />
            <span className="hidden sm:inline">{visited ? t('result.been') : t('result.beenMarked')}</span>
          </button>
          <div className="w-px h-4 hidden sm:block" style={{ background: '#FDE6C8' }} />
          <button
            onClick={handleLike}
            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-full transition-all text-xs font-medium whitespace-nowrap"
            style={liked ? {
              background: '#2D9CDB',
              color: '#fff',
              border: '2px solid #2D9CDB',
            } : {
              background: '#fff',
              color: '#A89F8E',
              border: '2px solid transparent',
            }}
          >
            <IconThumbsUp className="w-4 h-4" filled={liked} />
            <span>{liked ? t('result.liked') : t('result.like')}</span>
          </button>
          <div className="w-px h-4 hidden sm:block" style={{ background: '#FDE6C8' }} />
          <button
            onClick={handleDislike}
            className="flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 rounded-full transition-all text-xs font-medium whitespace-nowrap"
            style={disliked ? {
              background: '#E8552A',
              color: '#fff',
              border: '2px solid #E8552A',
            } : {
              background: '#fff',
              color: '#A89F8E',
              border: '2px solid transparent',
            }}
          >
            <IconThumbsDown className="w-4 h-4" filled={disliked} />
            <span>{disliked ? t('result.disliked') : t('result.dislike')}</span>
          </button>
        </div>

        {expanded && (
          <div className="mt-5 pt-5 border-t-2 fade-in" style={{ borderColor: 'var(--color-border)' }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2 text-text-secondary bg-white border-2 border-ink px-3 py-2 rounded-xl" style={{ borderColor: 'var(--color-ink)' }}>
                <IconMapPin className="w-4 h-4 text-primary" />
                <span>{restaurant.address}</span>
              </div>
              <div className="flex items-center gap-2 text-text-secondary bg-white border-2 border-ink px-3 py-2 rounded-xl" style={{ borderColor: 'var(--color-ink)' }}>
                <IconClock className="w-4 h-4 text-primary" />
                <span>{restaurant.businessHours}</span>
              </div>
              {restaurant.phone && (
                <div className="flex items-center gap-2 text-text-secondary bg-white border-2 border-ink px-3 py-2 rounded-xl" style={{ borderColor: 'var(--color-ink)' }}>
                  <IconPhone className="w-4 h-4 text-primary" />
                  <span>{restaurant.phone}</span>
                </div>
              )}
            </div>
            <button onClick={handleNavigate}
              className="btn-primary w-full py-3 text-sm mt-4 flex items-center justify-center gap-2">
              <IconNavigation className="w-4 h-4" /> {t('result.navigate')}
            </button>
          </div>
        )}
      </div>
    </div>

    {lightboxOpen && (
      <Lightbox
        photos={photos}
        currentIndex={effectiveIndex >= 0 ? effectiveIndex : 0}
        onClose={handleCloseLightbox}
        onPrev={handleLightboxPrev}
        onNext={handleLightboxNext}
      />
    )}
    </>
  );
}

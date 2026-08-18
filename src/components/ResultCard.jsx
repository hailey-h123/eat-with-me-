import { useState, useEffect } from 'react';
import {
  IconMapPin, IconClock, IconPhone, IconChevronRight, IconChevronLeft, IconStar,
  IconNavigation, IconLightbulb, IconCheck, IconCross, IconHalfCheck,
  IconThumbsUp, IconThumbsDown, IconBookmark, IconCheckCircle,
  IconPerfectFusion, IconFlavorFusion, IconStyleFusion,
  IconHeart, IconShieldCheck, IconWallet, IconComment, IconChart
} from './icons/FancyIcons';
import { FoodDecor } from './Mascot';
import Lightbox from './Lightbox';
import { hasLiked, hasDisliked, removeLike, removeDislike } from '../services/feedbackService';
import { isFavorited, toggleFavorite, isVisited, toggleVisited } from '../services/historyService';
import { trackFavorite, trackNavigate } from '../services/analyticsService';

// 过滤掉高德 poitype 中过于泛化的大类名（真实 API 返回的是分号分隔的层级分类）
// 但保留"地方菜系"这种在中文里有意义的标签
const GENERIC_TAGS = new Set([
  '餐饮服务', '餐饮相关场所', '餐饮相关', '餐饮', '餐饮服务场所',
  '餐厅', '餐馆', '饭馆', '饮食', '食品', '美食',
  '中式餐饮', '外国餐厅', '小吃快餐店', '快餐厅',
  '饮品店', '茶艺馆', '酒吧', '冷饮店',
  '糕饼店', '面包店', '烘焙甜品',
  '综合商场', '购物相关场所',
  '医疗保健服务', '住宿服务',
]);

function filterTags(tags, restaurantName = '') {
  if (!tags || tags.length === 0) return [];
  const nameWithoutBrackets = (restaurantName || '').replace(/[\(\)（）].*/, '').trim();
  return tags.filter(tag => {
    if (!tag) return false;
    // 泛化大类直接过滤（例如"中式餐饮"、"饮品店"）
    if (GENERIC_TAGS.has(tag)) return false;
    // 包含"餐饮相关"/"服务场所"/"餐饮服务"等大颗粒子串的也过滤
    if (/餐饮服务|餐饮相关|服务场所|相关场所|综合服务|购物场所|住宿服务/.test(tag)) return false;
    // 名字中包含或和店名重复（避免"海底捞"店再显示"海底捞"标签）
    if (nameWithoutBrackets && (nameWithoutBrackets.includes(tag) || tag.includes(nameWithoutBrackets))) return false;
    return true;
  });
}

// ============ 成员维度：六边形雷达图（5维+1空轴） ============
// 正好 5 个维度（菜系/忌口/预算/距离/评分）占 5 根轴，第 6 根（正下）留空，
// 让 5 边形在六边形骨架里视觉更平衡，同时避免长条纵向占地过大
const DIMENSIONS_RADAR = [
  { key: 'cuisine',  label: '菜系', angleIndex: 0 }, // 正上
  { key: 'allergy',  label: '忌口', angleIndex: 1 }, // 左上
  { key: 'budget',   label: '预算', angleIndex: 2 }, // 左下
  //       index 3 = 正下（空轴，平衡用，无数据）
  { key: 'distance', label: '距离', angleIndex: 4 }, // 右下
  { key: 'rating',   label: '评分', angleIndex: 5 }, // 右上
];

function hexToRgba(hex, alpha) {
  const h = (hex || '').replace('#', '');
  if (h.length !== 6) return `rgba(124, 92, 255, ${alpha})`;
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// 身份色板（按成员 index 取色，循环覆盖 2~8 人）：6 种高饱和但不打架的色相
// 区分度优先：蓝紫/橙/青绿/品红/湖蓝/琥珀黄，6 种两两视觉距离都大
const MEMBER_PALETTE = [
  '#7C5CFF', // 0 蓝紫
  '#FF9444', // 1 橙（浅亮橙）
  '#2CB289', // 2 青绿
  '#E8528A', // 3 品红
  '#2E93D6', // 4 湖蓝
  '#D4A017', // 5 琥珀黄
];

// 分档调「亮度/饱和度」：把身份色按 overall 分档变成不同的明暗
//   tier A (>=85) 原色最饱最亮（*1.0 / 细粉描边）
//   tier B (>=70) 略暗 80%
//   tier C (>=55) 再暗 65%
//   tier D (<55)  最暗 50%
function scaleBrightness(hex, factor) {
  const h = (hex || '').replace('#', '');
  if (h.length !== 6) return hex;
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v * factor)));
  const toHex = (v) => clamp(v).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function tierFactor(v) {
  if (v >= 85) return [1.00, 1.6, 0.22]; // 亮度倍，描边厚，填充不透明
  if (v >= 70) return [0.92, 1.4, 0.19];
  if (v >= 55) return [0.85, 1.2, 0.16];
  return          [0.78, 1.0, 0.13];
}

function MemberRadarHex({ dims, overall, name, memberIndex = 0 }) {
  const cx = 78;
  const cy = 51;
  const r0 = 38;
  // index 0..5 从正上方逆时针每 60° 一根轴
  const angleFor = (i) => Math.PI / 2 + (i * Math.PI) / 3;
  const hexRing = (r) =>
    Array.from({ length: 6 }, (_, i) => {
      const a = angleFor(i);
      return [cx + r * Math.cos(a), cy - r * Math.sin(a)];
    })
      .map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`)
      .join(' ');

  // 分档语义色：绿/蓝/橙/红 — 只用于「综合分数字」和各维度标签色，继续表达好坏语义
  const overallColor = (v) => {
    if (v >= 85) return '#6BCB77';
    if (v >= 70) return '#2D9CDB';
    if (v >= 55) return '#F0A818';
    return '#E8552A';
  };
  const dimColor = (v) => {
    if (v == null) return '#C9C0AE';
    if (v >= 80) return '#6BCB77';
    if (v >= 60) return '#F0A818';
    return '#E8552A';
  };
  // 身份色（按成员 index 取）→ 分档调明暗：同成员同档在多餐厅也能一眼对应
  const idBase = MEMBER_PALETTE[((memberIndex % MEMBER_PALETTE.length) + MEMBER_PALETTE.length) % MEMBER_PALETTE.length];
  const [brightK, strokeW, fillAlpha] = tierFactor(overall);
  const idColor = scaleBrightness(idBase, brightK);
  const scoreColor = overallColor(overall);

  // 5 个维度 → 5 个数据点；null/NaN 值按 0.5（中线）占位但标签显示"—"
  const safeNum = (v) => (typeof v === 'number' && !isNaN(v)) ? v : null;
  const dataPoints = DIMENSIONS_RADAR.map((dim) => {
    const raw = safeNum(dims[dim.key]);
    const ratio = raw == null ? 0.5 : Math.max(0, Math.min(100, raw)) / 100;
    const r = r0 * ratio;
    const a = angleFor(dim.angleIndex);
    return {
      x: cx + r * Math.cos(a),
      y: cy - r * Math.sin(a),
      value: raw,
      key: dim.key,
      dim,
    };
  });
  const pointsStr = dataPoints.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  // 轴标签位置：标签紧贴六边形，rLabel = r0 + 7（再拉近）
  const rLabel = r0 + 7;
  const labelMeta = DIMENSIONS_RADAR.map((dim) => {
    const a = angleFor(dim.angleIndex);
    const lx = cx + rLabel * Math.cos(a);
    const ly = cy - rLabel * Math.sin(a);
    let anchor = 'middle';
    if (dim.angleIndex === 1 || dim.angleIndex === 2) anchor = 'start';
    if (dim.angleIndex === 4 || dim.angleIndex === 5) anchor = 'end';
    const val = safeNum(dims[dim.key]);
    return {
      lx, ly, anchor, dim,
      valText: val == null ? '—' : `${val}`,
      valColor: dimColor(val),
    };
  });

  return (
    <div
      className="rounded-lg bg-white overflow-hidden"
      style={{
        border: `1px solid ${hexToRgba(idColor, 0.45)}`,
      }}
    >
      {/* 头部：姓名 + 综合分，pt-1 极少量上内边距，避免顶边文字贴边框 */}
      <div className="flex items-center justify-between px-2 pt-1 leading-none">
        <span
          className="text-[11px] font-extrabold leading-none"
          style={{ fontFamily: 'var(--font-display)', color: idColor }}
        >
          {name}
        </span>
        <span className="flex items-baseline gap-0.5 leading-none">
          <span className="text-[8px] font-bold text-text-muted leading-none">综合</span>
          <span
            className="text-[14px] font-extrabold leading-none"
            style={{ color: scoreColor, fontFamily: 'var(--font-display)' }}
          >
            {overall}
          </span>
        </span>
      </div>

      {/* -mt-[5px]：让 SVG 顶部标签和头部文字之间几乎不留空隙（红框位置）
           viewBox 156×100：高再压，配合 cy=51 让顶部标签 y=6 几乎贴 SVG 顶 */}
      <svg
        viewBox="0 0 156 100"
        width="100%"
        height="auto"
        className="-mt-[5px]"
        style={{ display: 'block' }}
      >
        {/* 3 层同心六边形参考网格 */}
        <polygon
          points={hexRing(r0 * 0.33)}
          fill="none"
          stroke="rgba(0,0,0,0.05)"
          strokeWidth="1"
        />
        <polygon
          points={hexRing(r0 * 0.66)}
          fill="none"
          stroke="rgba(0,0,0,0.06)"
          strokeWidth="1"
        />
        <polygon
          points={hexRing(r0)}
          fill="none"
          stroke="rgba(0,0,0,0.08)"
          strokeWidth="1"
        />
        {/* 6 根轴线 */}
        {Array.from({ length: 6 }, (_, i) => {
          const a = angleFor(i);
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={(cx + r0 * Math.cos(a)).toFixed(1)}
              y2={(cy - r0 * Math.sin(a)).toFixed(1)}
              stroke="rgba(0,0,0,0.06)"
              strokeWidth="1"
            />
          );
        })}
        {/* 数据多边形：身份色相 + 分档调明暗/填充透/描边厚 */}
        <polygon
          points={pointsStr}
          fill={hexToRgba(idColor, fillAlpha)}
          stroke={idColor}
          strokeWidth={strokeW}
          strokeLinejoin="round"
        />
        {/* 数据顶点：身份色填充；分档高的点稍大（更突出） */}
        {dataPoints
          .filter((p) => p.value != null)
          .map((p, i) => (
            <circle
              key={i}
              cx={p.x.toFixed(1)}
              cy={p.y.toFixed(1)}
              r={1.8 + strokeW * 0.25}
              fill={idColor}
              stroke="#fff"
              strokeWidth="0.8"
            />
          ))}
        {/* 中心水印 */}
        <text
          x={cx}
          y={cy + 3}
          textAnchor="middle"
          fontSize="9"
          fontWeight="700"
          fill="rgba(0,0,0,0.14)"
          style={{ fontFamily: 'var(--font-display)', pointerEvents: 'none' }}
        >
          {overall}
        </text>
        {/* 轴标签：字号整体缩小 1~2px，行高更紧凑 */}
        {labelMeta.map((m) => {
          const isVertical = m.dim.angleIndex === 0;
          if (isVertical) {
            return (
              <g key={m.dim.key}>
                <text
                  x={m.lx}
                  y={m.ly - 3}
                  textAnchor="middle"
                  fontSize="8.5"
                  fontWeight="800"
                  fill="rgba(0,0,0,0.45)"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {m.dim.label}
                </text>
                <text
                  x={m.lx}
                  y={m.ly + 6}
                  textAnchor="middle"
                  fontSize="9.5"
                  fontWeight="800"
                  fill={m.valColor}
                  style={{ fontFamily: 'var(--font-metric)' }}
                >
                  {m.valText}
                </text>
              </g>
            );
          }
          return (
            <g key={m.dim.key}>
              <text
                x={m.lx}
                y={m.ly - 1}
                textAnchor={m.anchor}
                fontSize="8.5"
                fontWeight="800"
                fill="rgba(0,0,0,0.45)"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {m.dim.label}
              </text>
              <text
                x={m.lx}
                y={m.ly + 7.5}
                textAnchor={m.anchor}
                fontSize="9.5"
                fontWeight="800"
                fill={m.valColor}
                style={{ fontFamily: 'var(--font-metric)' }}
              >
                {m.valText}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function ResultCard({ restaurant, showExploreMessage = false, isSolo = false, onFeedback }) {
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
    if (disliked) { setDisliked(false); }
    // onFeedback 始终存在：App 侧负责 removeDislike + addLike（带偏好指纹）
    onFeedback('like', restaurant);
  };

  const handleDislike = (e) => {
    e.stopPropagation();
    if (disliked) {
      setDisliked(false);
      removeDislike(restaurant.id);
      return;
    }
    setDisliked(true);
    if (liked) { setLiked(false); }
    // onFeedback 始终存在：App 侧负责 removeLike + addDislike（带偏好指纹）
    onFeedback('dislike', restaurant);
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

  const handleViewReviews = (e) => {
    e.stopPropagation();
    window.open(`https://www.amap.com/search?query=${encodeURIComponent(restaurant.name)}`, '_blank');
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

  // 合并 tags + features（真实 API 返回的 tags 是 poitype 路径，features 还有评分/融合用的特征词）
  // 去重后展示，但不与 featureTags 重复（特色 pill 已经会单独显示）
  const featureTagSet = new Set(restaurant.featureTags || []);
  const mergedTagPool = [...new Set([
    ...(restaurant.tags || []),
    ...(restaurant.features || []),
  ])].filter(t => !featureTagSet.has(t));
  const filteredTags = filterTags(mergedTagPool, restaurant.name).slice(0, 3);
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
      className="flat-card mb-4 cursor-pointer relative overflow-hidden"
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
        <div className="relative w-full h-36 sm:h-48 overflow-hidden group" style={{ borderBottom: '2.5px solid var(--color-ink)' }}>
          <img
            src={currentUrl}
            alt={restaurant.name}
            onError={handleImgError}
            onClick={handleOpenLightbox}
            className="w-full h-full object-cover cursor-zoom-in"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
          {/* Solo 模式不显示分数：单人推荐以 reasons 为主，分数参考意义有限 */}
          {!isSolo && (
          <span className={`absolute top-3 right-3 px-3 py-1 rounded-full text-xs font-extrabold bg-white border-2.5 border-ink shadow-[3px_3px_0_var(--color-ink)] ${getScoreStyle(displayScore)}`}
            style={{ borderColor: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>
            {displayScore}分
          </span>
          )}

          {/* 多图轮播控件 */}
          {showCarousel && (
            <>
              {/* 左右箭头 */}
              <button onClick={handlePrevPhoto}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-8 sm:h-8 rounded-full bg-white/80 border-2 border-ink flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shadow-[2px_2px_0_var(--color-ink)]"
                style={{ borderColor: 'var(--color-ink)' }}>
                <IconChevronLeft className="w-4 h-4 text-text" />
              </button>
              <button onClick={handleNextPhoto}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-8 sm:h-8 rounded-full bg-white/80 border-2 border-ink flex items-center justify-center opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shadow-[2px_2px_0_var(--color-ink)]"
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

      <div className="p-4 sm:p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1 min-w-0">
            <h3 className="font-extrabold text-lg sm:text-xl text-text pr-3 break-words" style={{ fontFamily: 'var(--font-display)' }}>{restaurant.name}</h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <span className="text-sm text-text-secondary">{restaurant.cuisine}</span>
              {restaurant.solutionTier && restaurant.solutionTier > 1 && (
                <>
                  <span className="text-text-muted">·</span>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-extrabold border-2`}
                    style={{
                      fontFamily: 'var(--font-display)',
                      borderColor: 'var(--color-ink)',
                      background: restaurant.solutionTier === 2 ? 'rgba(255,122,89,0.12)' : 'rgba(245,158,11,0.12)',
                      color: restaurant.solutionTier === 2 ? '#FF6B3D' : '#D97706',
                    }}>
                    {restaurant.solutionTier === 2 ? '方案2 · 场景化解' : '方案3 · 折中推荐'}
                  </span>
                </>
              )}
              <span className="text-text-muted">·</span>
              <span className="text-sm text-text-secondary">人均{restaurant.price}元</span>
            </div>
          </div>
          {!currentUrl && !isSolo && (
            <span className={`px-4 py-1.5 rounded-full text-xs font-extrabold flex-shrink-0 border-2.5 border-ink shadow-[3px_3px_0_var(--color-ink)] ${getScoreStyle(displayScore)}`}
              style={{ borderColor: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>
              {displayScore}分
            </span>
          )}
        </div>

        {/* 个人满足度：每个成员的维度分解 + 综合分 */}
        {restaurant.memberScores && restaurant.memberScores.length >= 1 && (
          <div
            className="mb-3.5 p-2.5 rounded-xl border-2"
            style={{ borderColor: 'var(--color-ink)', background: 'rgba(124,92,255,0.04)' }}
          >
            <div
              className="flex items-center gap-1.5 text-xs font-extrabold text-text-secondary mb-1.5"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              <span
                className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] text-white"
                style={{ background: '#7c5cff' }}
              >
                <IconChart className="w-3 h-3 text-white" />
              </span>
              成员满足度
            </div>
            {/* 紧凑版：gap 从 2.5 减到 1.5，纵向再省一截 */}
            {/* 窄屏 (<640px) 强制 1 列，sm 以上多成员 2 列，单成员始终 1 列 */}
            <div
              className={
                restaurant.memberScores.length === 1
                  ? 'grid grid-cols-1 gap-1.5'
                  : 'grid grid-cols-1 sm:grid-cols-2 gap-1.5'
              }
            >
              {restaurant.memberScores.map((ms, idx) => {
                const dims = ms.dimensions || {};
                const overall =
                  typeof ms.overall === 'number'
                    ? ms.overall
                    : Math.round(ms.score || 0);
                const name = ms.name || ms.member?.name || `成员${idx + 1}`;
                return (
                  <MemberRadarHex
                    key={idx}
                    memberIndex={idx}
                    dims={dims}
                    overall={overall}
                    name={name}
                  />
                );
              })}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 text-xs text-text-secondary flex-wrap mb-4">
          <span className="flex items-center gap-1.5 tag-pill">
            <IconMapPin className="w-3 h-3" /> 步行{restaurant.distance}分钟
          </span>
          <span className="flex items-center gap-1.5 tag-pill" style={{ background: 'rgba(255,201,60,0.15)', color: 'var(--color-accent-dark)' }}>
            <IconStar className="w-3 h-3" />
            {restaurant.rating}
          </span>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          {filteredTags.map(tag => (
            <span key={tag} className="px-3 py-1 rounded-full text-xs font-bold text-white border-2 border-ink shadow-[2px_2px_0_var(--color-ink)]"
              style={{ background: 'var(--color-primary)', borderColor: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}>
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
              一人食友好
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

        {/* === 底部统一框：总结 + 融合 + 成员明细（动态维度）+ 妥协点 === */}
        {(restaurant.reasons && restaurant.reasons.length > 0) && (() => {
          const hasMemberReasons = restaurant.memberScores && restaurant.memberScores.length >= 1
            && restaurant.memberScores.some(ms => ms.reasons && ms.reasons.length > 0);
          // 有成员级 reasons 时，成员级 reason（带 category）从平铺列表中移除，改由成员区块展示
          // 融合标题/详情也移除，成员卡片已展示各自偏好匹配结果
          const flatReasons = hasMemberReasons
            ? restaurant.reasons.filter(r => !r.category && r.type !== 'fusion' && r.type !== 'fusion-detail')
            : restaurant.reasons.filter(r => r.type !== 'fusion' && r.type !== 'fusion-detail');

          // 角色映射：从 compromiseDetails 提取忌口方/偏好方
          const allergyMemberMap = new Map();
          const prefMemberMap = new Map();
          if (restaurant.compromiseDetails) {
            restaurant.compromiseDetails.forEach(cd => {
              if (cd.conflict?.memberName) allergyMemberMap.set(cd.conflict.memberName, cd);
              if (cd.conflict?.prefMemberName) prefMemberMap.set(cd.conflict.prefMemberName, cd);
            });
          }
          // 妥协点
          const compromises = (restaurant.compromiseDetails || [])
            .filter(cd => cd.compromise)
            .map(cd => cd.compromise);
          // 去掉成员名前缀（成员区块已显示名字）
          const stripName = (text, name) => {
            if (!text || !name) return text || '';
            const p = `${name}：`;
            return text.startsWith(p) ? text.slice(p.length) : text;
          };

          return (
            <div className="mt-4 p-4 bg-bg-soft rounded-xl space-y-2 border-2 border-ink" style={{ borderColor: 'var(--color-ink)' }}>
              {/* 1. 非成员级 reasons：总结行 + 融合 + group mismatch（保持原有渲染） */}
              {flatReasons.map((reason, index) => {
                let icon;
                let iconColor = '';

                if (reason.type === 'group') {
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
                } else {
                  // match / partial / mismatch：颜色按匹配度，图标按 category 差异化
                  if (reason.type === 'match') {
                    iconColor = 'text-secondary';
                  } else if (reason.type === 'partial') {
                    iconColor = 'text-accent-dark';
                  } else {
                    iconColor = 'text-text-muted';
                  }
                  const StatusIcon = {
                    distance: IconClock,
                    preference: IconHeart,
                    allergy: IconShieldCheck,
                    budget: IconWallet,
                    general: IconCheck,
                  }[reason.category] || IconCheck;
                  if (reason.type === 'partial') {
                    icon = <IconHalfCheck className="w-3 h-3" />;
                  } else if (reason.type !== 'match') {
                    icon = <IconCross className="w-3 h-3" />;
                  } else {
                    icon = <StatusIcon className="w-3 h-3" />;
                  }
                }

                return (
                  <div key={index} className="text-sm flex items-start gap-2.5 text-text" style={{ fontFamily: 'var(--font-display)' }}>
                    <span className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center bg-white border-2 border-ink ${iconColor} text-[12px] leading-none`} style={{ borderColor: 'var(--color-ink)' }}>
                      {icon}
                    </span>
                    <span className="leading-relaxed font-medium">{reason.text}</span>
                  </div>
                );
              })}

              {/* 2. 成员区块：每个成员按需展示维度（菜系/忌口/预算/距离），冲突方用化解文案 */}
              {hasMemberReasons && restaurant.memberScores.map((ms, idx) => {
                const name = ms.name || ms.member?.name || `成员${idx + 1}`;
                const memberReasons = ms.reasons || [];
                const allergyCd = allergyMemberMap.get(name);
                const prefCd = prefMemberMap.get(name);

                // 按维度顺序构建展示列表（动态：有偏好才显示菜系，有忌口才显示忌口...）
                // 化解 tier → 显示类型：tier1=match(绿勾)，tier2/3=partial(半勾)
                const compromiseType = (cd) => cd?.tier === 1 ? 'match' : 'partial';
                const dims = [];
                // 菜系（一条或多条：可能多个偏好）
                if (prefCd) {
                  dims.push({ type: compromiseType(prefCd), category: 'preference', text: prefCd.prefSide });
                } else {
                  memberReasons
                    .filter(r => r.category === 'preference')
                    .forEach(r => dims.push({ type: r.type, category: 'preference', text: stripName(r.text, name) }));
                }
                // 忌口（一条或多条：可能多个忌口如辣+海鲜）
                if (allergyCd) {
                  dims.push({ type: compromiseType(allergyCd), category: 'allergy', text: allergyCd.allergySide });
                } else {
                  memberReasons
                    .filter(r => r.category === 'allergy')
                    .forEach(r => dims.push({ type: r.type, category: 'allergy', text: stripName(r.text, name) }));
                }
                // 预算（有预算要求才显示）
                const budgetR = memberReasons.find(r => r.category === 'budget');
                if (budgetR) dims.push({ type: budgetR.type, category: 'budget', text: stripName(budgetR.text, name) });
                // 距离（永远显示）
                const distR = memberReasons.find(r => r.category === 'distance');
                if (distR) dims.push({ type: distR.type, category: 'distance', text: stripName(distR.text, name) });
                // 无偏好无忌口的兜底
                const genR = memberReasons.find(r => r.category === 'general');
                if (genR) dims.push({ type: genR.type, category: 'general', text: stripName(genR.text, name) });

                if (dims.length === 0) {
                  // 兜底：至少显示一条，避免成员"消失"
                  dims.push({ type: 'match', category: 'general', text: '无特殊偏好或忌口' });
                }

                return (
                  <div key={idx} className="rounded-lg p-2.5 border" style={{ borderColor: 'rgba(0,0,0,0.1)', background: 'rgba(255,255,255,0.5)' }}>
                    {/* 成员名 + 角色标签（多维叠加：方案B，有啥显示啥） */}
                    <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                      <span className="text-xs font-extrabold text-text" style={{ fontFamily: 'var(--font-display)' }}>{name}</span>
                      {(ms.roles && ms.roles.length > 0) ? (
                        ms.roles.map((role, ri) => (
                          <span
                            key={role.key}
                            className="px-1.5 py-0.5 rounded text-[10px] font-extrabold text-white"
                            style={{ background: role.color }}
                          >
                            {role.label}
                          </span>
                        ))
                      ) : (
                        <>
                          {allergyCd && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold text-white" style={{ background: '#7c5cff' }}>忌口方</span>
                          )}
                          {prefCd && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold text-white" style={{ background: '#22c55e' }}>偏好方</span>
                          )}
                        </>
                      )}
                    </div>
                    {/* 维度明细 */}
                    {dims.map((dim, di) => {
                      let icon, color;
                      // 颜色仍按匹配度（语义色）
                      if (dim.type === 'match') { color = 'text-secondary'; }
                      else if (dim.type === 'partial') { color = 'text-accent-dark'; }
                      else { color = 'text-text-muted'; }
                      // 图标按 category 差异化显示，匹配度决定是否用"半勾/叉"变体
                      const StatusIcon = {
                        distance: IconClock,
                        preference: IconHeart,
                        allergy: IconShieldCheck,
                        budget: IconWallet,
                        general: IconCheck,
                      }[dim.category] || IconCheck;
                      // partial / mismatch 用原有的语义图标（对勾家族更能表达匹配度）
                      if (dim.type === 'partial') {
                        icon = <IconHalfCheck className="w-3 h-3" />;
                      } else if (dim.type !== 'match') {
                        icon = <IconCross className="w-3 h-3" />;
                      } else {
                        icon = <StatusIcon className="w-3 h-3" />;
                      }
                      return (
                        <div key={di} className="text-xs flex items-start gap-1.5 text-text mb-1 last:mb-0" style={{ fontFamily: 'var(--font-display)' }}>
                          <span className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center bg-white border ${color} text-[10px] leading-none`} style={{ borderColor: 'rgba(0,0,0,0.15)' }}>
                            {icon}
                          </span>
                          <span className="leading-relaxed">{dim.text}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {/* 3. 妥协点（所有成员之后，单独显示） */}
              {compromises.length > 0 && compromises.map((c, idx) => (
                <div key={idx} className="text-xs flex items-start gap-2" style={{ fontFamily: 'var(--font-display)' }}>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold flex-shrink-0" style={{ background: 'rgba(245,158,11,0.18)', color: '#D97706' }}>妥协点</span>
                  <span className="text-text-secondary leading-relaxed">{c}</span>
                </div>
              ))}
            </div>
          );
        })()}


        <div className="mt-4 flex items-center justify-center text-text-muted text-xs font-bold" style={{ fontFamily: 'var(--font-display)' }}>
          <span className="hover:text-primary transition-colors">{expanded ? '收起详情' : '点击查看详情'}</span>
          <IconChevronRight className={`w-4 h-4 ml-1 transition-all duration-300 ${expanded ? 'rotate-90 text-primary' : ''}`} />
        </div>

        <div className="mt-3 flex items-center justify-center gap-1.5 sm:gap-3 flex-wrap">
          <button
            onClick={handleFavorite}
            className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-2.5 sm:py-1.5 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 rounded-full transition-all text-xs font-medium"
            style={favorited ? {
              background: 'rgba(255,201,60,0.15)',
              color: '#F0A818',
            } : {
              color: '#A89F8E',
            }}
          >
            <IconBookmark className="w-4 h-4" filled={favorited} />
            <span className="hidden sm:inline">{favorited ? '已收藏' : '收藏'}</span>
          </button>
          <div className="w-px h-4 hidden sm:block" style={{ background: '#FDE6C8' }} />
          <button
            onClick={handleVisit}
            className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-2.5 sm:py-1.5 min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 rounded-full transition-all text-xs font-medium"
            style={visited ? {
              background: 'rgba(107,203,119,0.15)',
              color: '#6BCB77',
            } : {
              color: '#A89F8E',
            }}
          >
            <IconCheckCircle className="w-4 h-4" filled={visited} />
            <span className="hidden sm:inline">{visited ? '去过' : '标记去过'}</span>
          </button>
          <div className="w-px h-4 hidden sm:block" style={{ background: '#FDE6C8' }} />
          <button
            onClick={handleLike}
            className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-2.5 sm:py-1.5 min-h-[44px] sm:min-h-0 rounded-full transition-all text-xs font-medium whitespace-nowrap"
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
            <span>{liked ? '已喜欢' : '喜欢'}</span>
          </button>
          <div className="w-px h-4 hidden sm:block" style={{ background: '#FDE6C8' }} />
          <button
            onClick={handleDislike}
            className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-2.5 sm:py-1.5 min-h-[44px] sm:min-h-0 rounded-full transition-all text-xs font-medium whitespace-nowrap"
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
            <span>{disliked ? '已不喜欢' : '不喜欢'}</span>
          </button>
        </div>

        {expanded && (
          <div className="mt-5 pt-5 border-t-2 fade-in" style={{ borderColor: 'var(--color-border)' }}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              <div className="flex items-start gap-2 text-text-secondary bg-white border-2 border-ink px-3 py-2 rounded-xl" style={{ borderColor: 'var(--color-ink)' }}>
                <IconMapPin className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <span className="min-w-0 break-words">{restaurant.address}</span>
              </div>
              <div className="flex items-start gap-2 text-text-secondary bg-white border-2 border-ink px-3 py-2 rounded-xl" style={{ borderColor: 'var(--color-ink)' }}>
                <IconClock className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <span className="min-w-0 break-words">{restaurant.businessHours}</span>
              </div>
              {restaurant.phone && (
                <div className="flex items-start gap-2 text-text-secondary bg-white border-2 border-ink px-3 py-2 rounded-xl" style={{ borderColor: 'var(--color-ink)' }}>
                  <IconPhone className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                  <span className="min-w-0 break-all">{restaurant.phone}</span>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={handleViewReviews}
                className="flex-1 py-3 text-sm flex items-center justify-center gap-2 border-2 rounded-xl bg-white hover:bg-gray-50 transition-colors"
                style={{ borderColor: 'var(--color-ink)' }}>
                <IconComment className="w-4 h-4" /> 查看评论
              </button>
              <button onClick={handleNavigate}
                className="flex-1 btn-primary py-3 text-sm flex items-center justify-center gap-2">
                <IconNavigation className="w-4 h-4" /> 导航过去
              </button>
            </div>
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

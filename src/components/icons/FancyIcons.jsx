/**
 * FancyIcons — Refined icon system for eat-with-me
 * Design language: precise 1.6px strokes, rounded caps, subtle gradients,
 * soft inner highlights. Unified 24px grid for UI icons, 48px for brand/feature icons.
 */

// Shared gradient defs for brand icons (keeps ids unique per render via useId-like pattern)
const BrandGradients = () => (
  <defs>
    <linearGradient id="ewmPrimary" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#FF8A5B" />
      <stop offset="55%" stopColor="#FF6B35" />
      <stop offset="100%" stopColor="#E8541A" />
    </linearGradient>
    <linearGradient id="ewmTeal" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#2DD4BF" />
      <stop offset="55%" stopColor="#14B8A6" />
      <stop offset="100%" stopColor="#0D9488" />
    </linearGradient>
    <linearGradient id="ewmAmber" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stopColor="#FDE68A" />
      <stop offset="100%" stopColor="#F59E0B" />
    </linearGradient>
    <linearGradient id="ewmSheen" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.35" />
      <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0" />
    </linearGradient>
  </defs>
);

// ============ Brand & Feature Icons (48px) ============

export function IconLogo({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <BrandGradients />
      {/* plate */}
      <circle cx="24" cy="24" r="20" fill="url(#ewmPrimary)" />
      <circle cx="24" cy="24" r="20" fill="url(#ewmSheen)" />
      {/* fork + knife */}
      <path d="M18 14v8a2 2 0 0 0 2 2v10" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 14v4M20 14v4" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M30 14c-1.8 0-3 2-3 5s1.2 5 3 5v10" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconSolo({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <BrandGradients />
      <circle cx="24" cy="24" r="20" fill="url(#ewmPrimary)" />
      <circle cx="24" cy="24" r="20" fill="url(#ewmSheen)" />
      {/* single person — elegant */}
      <circle cx="24" cy="19" r="5.5" stroke="white" strokeWidth="1.8" fill="none" />
      <path d="M14 36c0-5.5 4.5-10 10-10s10 4.5 10 10" stroke="white" strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function IconGroup({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <BrandGradients />
      <circle cx="24" cy="24" r="20" fill="url(#ewmTeal)" />
      <circle cx="24" cy="24" r="20" fill="url(#ewmSheen)" />
      {/* two people overlapping */}
      <circle cx="18" cy="19" r="4.5" stroke="white" strokeWidth="1.7" fill="none" />
      <circle cx="30" cy="19" r="4.5" stroke="white" strokeWidth="1.7" fill="none" />
      <path d="M10 35c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke="white" strokeWidth="1.7" strokeLinecap="round" fill="none" />
      <path d="M22 35c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke="white" strokeWidth="1.7" strokeLinecap="round" fill="none" />
    </svg>
  );
}

export function IconSparkles({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 3l1.6 4.9L18.5 9.5 13.6 11.1 12 16l-1.6-4.9L5.5 9.5l4.9-1.6L12 3z" fill="currentColor" />
      <path d="M18.5 14l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2z" fill="currentColor" opacity="0.5" />
    </svg>
  );
}

export function IconSparkle({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 3l1.6 4.9L18.5 9.5 13.6 11.1 12 16l-1.6-4.9L5.5 9.5l4.9-1.6L12 3z" fill="currentColor" />
      <path d="M18.5 14l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2z" fill="currentColor" opacity="0.5" />
    </svg>
  );
}

// ============ UI Icons (24px, stroke-based) ============

export function IconArrowLeft({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

export function IconChevronLeft({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}

export function IconChevronRight({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

export function IconMapPin({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

export function IconStar({ className = '', filled = false }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.1 6.5L12 17.8l-5.8 2.7 1.1-6.5L2.5 9.4l6.6-.9L12 2.5z" />
    </svg>
  );
}

export function IconClock({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}

export function IconRefresh({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 4v5h-5" />
    </svg>
  );
}

export function IconRefreshCw({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 4v5h-5" />
    </svg>
  );
}

export function IconLightbulb({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18h6M10 21h4" />
      <path d="M12 3a6 6 0 0 0-4 10.5c.8.8 1.5 1.8 1.5 2.5h5c0-.7.7-1.7 1.5-2.5A6 6 0 0 0 12 3z" />
    </svg>
  );
}

export function IconCheck({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 13l4 4L19 7" />
    </svg>
  );
}

export function IconCross({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
      <path d="M7 7l10 10M17 7L7 17" />
    </svg>
  );
}

export function IconHalfCheck({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      {/* 对勾路径：偏左下，延伸到中心 */}
      <path d="M4 14l5 5L16 7" />
      {/* 叉号路径：从中心偏左交叉到右下 */}
      <path d="M8 6l12 12" />
      {/* 叉号路径：从右上交叉到左下 */}
      <path d="M20 6L8 18" />
    </svg>
  );
}

export function IconX({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function IconBan({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M5.6 5.6l12.8 12.8" />
    </svg>
  );
}

export function IconWarning({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}

export function IconAlertCircle({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  );
}

export function IconHeart({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 22l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
    </svg>
  );
}

export function IconShare({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
    </svg>
  );
}

export function IconPhone({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2 4.2 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.5 2.7.7a2 2 0 0 1 1.7 2z" />
    </svg>
  );
}

export function IconNavigation({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11l19-9-9 19-2-8-8-2z" />
    </svg>
  );
}

export function IconEdit2({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  );
}

export function IconPlus({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconTrash2({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

export function IconUser({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4.5" />
      <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
    </svg>
  );
}

export function IconUsers({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3.8" />
      <path d="M2.5 21v-1a5.5 5.5 0 0 1 5.5-5.5h2a5.5 5.5 0 0 1 5.5 5.5v1" />
      <circle cx="17" cy="9" r="3" />
      <path d="M16 14.5a5 5 0 0 1 5.5 5v1" />
    </svg>
  );
}

export function IconShare2({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.6 13.5l6.8 4" />
      <path d="M15.4 6.5l-6.8 4" />
    </svg>
  );
}

export function IconLink({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5" />
      <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5" />
    </svg>
  );
}

export function IconSearch({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7.5" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

export function IconLoader2({ className = '' }) {
  return (
    <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none" style={{ transformOrigin: 'center center' }}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeDasharray="20 4" />
    </svg>
  );
}

export function IconVote({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 12l2 2 4-4" />
      <path d="M21 12a9 9 0 1 1-6.2-8.6" />
    </svg>
  );
}

export function IconDice({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <circle cx="8.5" cy="8.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="8.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="8.5" cy="15.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="15.5" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconThinking({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="9" r="5" />
      <path d="M8.5 13.5A6.5 6.5 0 0 0 5 19v1" />
      <path d="M15.5 13.5A6.5 6.5 0 0 1 19 19v1" />
      <path d="M10 8.5h.01M14 8.5h.01" />
      <path d="M10.5 11.5c.8.6 2.2.6 3 0" />
    </svg>
  );
}

// ============ Fortune / Feature Icons (48px) ============

export function IconCrystalBall({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cbGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#E0E7FF" />
          <stop offset="50%" stopColor="#A78BFA" />
          <stop offset="100%" stopColor="#7C3AED" />
        </linearGradient>
        <linearGradient id="cbSheen" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.5" />
          <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="20" r="16" fill="url(#cbGrad)" />
      <circle cx="24" cy="20" r="16" fill="url(#cbSheen)" />
      <ellipse cx="19" cy="15" rx="5" ry="3" fill="white" opacity="0.4" />
      <path d="M16 38h16l-1.5 4a2 2 0 0 1-1.9 1.4H19.4a2 2 0 0 1-1.9-1.4L16 38z" fill="#6B7280" />
      <path d="M14 38h20" stroke="#6B7280" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="28" cy="24" r="1.5" fill="white" opacity="0.6" />
      <circle cx="22" cy="26" r="1" fill="white" opacity="0.4" />
    </svg>
  );
}

export function IconCompass({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="24" cy="24" r="20" />
      <circle cx="24" cy="24" r="15" strokeOpacity="0.3" />
      <path d="M24 14l4 10-4 10-4-10 4-10z" fill="currentColor" fillOpacity="0.2" />
      <circle cx="24" cy="24" r="2.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconTarget({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="24" cy="24" r="20" />
      <circle cx="24" cy="24" r="14" />
      <circle cx="24" cy="24" r="8" />
      <circle cx="24" cy="24" r="2.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconRocket({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M24 6c-4 4-6 10-6 16v8l4 3h4l4-3v-8c0-6-2-12-6-16z" />
      <circle cx="24" cy="18" r="2.5" />
      <path d="M18 30l-4 5 5-2M30 30l4 5-5-2" />
      <path d="M22 40c0 2 1 3 2 3s2-1 2-3" />
    </svg>
  );
}

export function IconCoffee({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 18h22v12a6 6 0 0 1-6 6H18a6 6 0 0 1-6-6V18z" />
      <path d="M34 22h4a4 4 0 0 1 0 8h-4" />
      <path d="M18 8c0 2-1 3-1 4M24 8c0 2-1 3-1 4M30 8c0 2-1 3-1 4" strokeOpacity="0.5" />
    </svg>
  );
}

export function IconFood({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 28a14 14 0 0 0 28 0v-4H10v4z" />
      <path d="M8 24h32" />
      <path d="M18 16c0-3 2-4 2-6M26 16c0-3 2-4 2-6" strokeOpacity="0.5" />
    </svg>
  );
}

export function IconDrink({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 14h20l-2 24a4 4 0 0 1-4 4H20a4 4 0 0 1-4-4l-2-24z" />
      <path d="M13 14h22" />
      <path d="M20 8c0 2-1 3-1 4M26 8c0 2-1 3-1 4" strokeOpacity="0.5" />
    </svg>
  );
}

export function IconUtensils({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8v12a3 3 0 0 0 3 3v17" />
      <path d="M15 8v6a3 3 0 0 0 6 0V8" />
      <path d="M30 8c-2 0-4 2-4 6v9h4v17" />
    </svg>
  );
}

export function IconWallet({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 14a4 4 0 0 1 4-4h24a4 4 0 0 1 4 4v20a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4V14z" />
      <path d="M8 18h32" />
      <circle cx="34" cy="28" r="3" fill="currentColor" />
    </svg>
  );
}

export function IconThumbsUp({ className = '', filled = false }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 38h14a4 4 0 0 0 4-3.5l2-14a4 4 0 0 0-4-4.5h-8l1-8a3 3 0 0 0-6-1l-5 9v12h6l3 11z" />
      <path d="M14 38H9a3 3 0 0 1-3-3V25a3 3 0 0 1 3-3h5" />
    </svg>
  );
}

export function IconThumbsDown({ className = '', filled = false }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 10h14a4 4 0 0 1 4 3.5l2 14a4 4 0 0 1-4 4.5h-8l1 8a3 3 0 0 1-6 1l-5-9V16h6l3-11z" />
      <path d="M14 10H9a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h5" />
    </svg>
  );
}

// ============ 历史/收藏/去过/设置 图标 (24px) ============

export function IconBookmark({ className = '', filled = false }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
    </svg>
  );
}

export function IconCheckCircle({ className = '', filled = false }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12l3 3 5-5" fill="none" />
    </svg>
  );
}

export function IconHistory({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 4v4h4" />
      <path d="M12 8v4l3 2" />
    </svg>
  );
}

export function IconSettings({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}

export function IconKey({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="7.5" cy="15.5" r="4.5" />
      <path d="M10.7 12.3L21 2" />
      <path d="M16 6l3 3" />
      <path d="M18 4l3 3" />
    </svg>
  );
}

export function IconTrash({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  );
}

export function IconTrophy({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
      <path d="M4 22h16" />
      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
      <path d="M18 2H6v7a6 6 0 0 0 12 0V2z" />
    </svg>
  );
}

export function IconFlavorFusion({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12c2-3 4-3 6 0s4 3 6 0 4-3 4-3" />
      <path d="M4 18c2-3 4-3 6 0s4 3 6 0 4-3 4-3" opacity="0.5" />
    </svg>
  );
}

export function IconStyleFusion({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="10" height="10" rx="2" />
      <rect x="11" y="11" width="10" height="10" rx="2" />
    </svg>
  );
}

export function IconPerfectFusion({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l2 5h5l-4 3.5 1.5 5L12 13.5 7.5 16.5 9 11 5 8h5l2-5z" fill="currentColor" />
    </svg>
  );
}

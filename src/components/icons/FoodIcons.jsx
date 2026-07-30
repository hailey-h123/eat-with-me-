/**
 * Custom SVG icon components replacing emojis.
 * All icons inherit color via currentColor for theme consistency.
 * Style: rounded, friendly, Apple-inspired with consistent 24px viewBox.
 */

const IconBase = ({ children, size = 24, className = '', ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    {...props}
  >
    {children}
  </svg>
);

const IconBaseFill = ({ children, size = 24, className = '', ...props }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    {...props}
  >
    {children}
  </svg>
);

// ============ Status Indicators ============

// Replaces ✓ (match)
export function IconCheck({ size, className, ...props }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size || 14} height={size || 14} viewBox="0 0 14 14" className={className} {...props}>
      <circle cx="7" cy="7" r="7" fill="#34c759" />
      <path d="M4 7l2 2 4-4" stroke="white" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Replaces ~ (partial match)
export function IconPartial({ size, className, ...props }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size || 14} height={size || 14} viewBox="0 0 14 14" className={className} {...props}>
      <circle cx="7" cy="7" r="7" fill="#ff9f0a" />
      <path d="M4 7.5h6" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

// Replaces ✗ (mismatch)
export function IconCross({ size, className, ...props }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size || 14} height={size || 14} viewBox="0 0 14 14" className={className} {...props}>
      <circle cx="7" cy="7" r="7" fill="#aeaeb2" />
      <path d="M5 5l4 4M9 5l-4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// ============ UI Symbols ============

// Replaces 🎲 (dice / random)
export function IconDice({ size, className, ...props }) {
  return (
    <IconBase size={size} className={className} {...props}>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <circle cx="8.5" cy="8.5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="8.5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="8.5" cy="15.5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="15.5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </IconBase>
  );
}

// Replaces 🤔 (thinking / no results)
export function IconThinking({ size, className, ...props }) {
  return (
    <IconBase size={size} className={className} {...props}>
      <circle cx="12" cy="8" r="5" />
      <path d="M5.5 13.5a6.5 6.5 0 0 1 13 0" />
      <circle cx="10" cy="8.8" r="0.7" fill="currentColor" stroke="none" />
      <circle cx="14" cy="8.8" r="0.7" fill="currentColor" stroke="none" />
      <path d="M9.5 12c.8.6 2.2.6 3 0" />
      <path d="M6 16c0 2.2 2.7 4 6 4s6-1.8 6-4" />
      <path d="M4 17c-1.5.5-2 2-1 3.2" />
      <path d="M20 17c1.5.5 2 2 1 3.2" />
    </IconBase>
  );
}

// Replaces ⛔ (hard conflict)
export function IconBan({ size, className, ...props }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" className={className} {...props}>
      <circle cx="12" cy="12" r="9" fill="#ff3b30" />
      <circle cx="12" cy="12" r="9" stroke="#ff3b30" strokeWidth="2.5" fill="none" />
      <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

// Replaces ⚠️ (soft conflict / warning)
export function IconWarning({ size, className, ...props }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" className={className} {...props}>
      <path d="M12 2L2 20h20L12 2z" fill="#ff9f0a" />
      <path d="M12 9v5" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="12" cy="16.5" r="0.1" fill="white" />
    </svg>
  );
}

// Replaces 🌟 (sparkle / fresh discovery)
export function IconSparkle({ size, className, ...props }) {
  return (
    <IconBaseFill size={size} className={className} {...props}>
      <path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2z" />
      <path d="M19.5 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2z" opacity="0.6" />
      <path d="M4 15l.6 1.6 1.6.6-1.6.6-.6 1.6-.6-1.6L2 17.2l1.6-.6L4 15z" opacity="0.5" />
    </IconBaseFill>
  );
}

// ============ Fortune / Crystal ============

// Replaces 🔮 (crystal ball / fortune)
export function IconCrystalBall({ size, className, ...props }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" className={className} {...props}>
      <circle cx="12" cy="10" r="8" fill="url(#crystalGrad)" stroke="currentColor" strokeWidth="1.5" />
      <ellipse cx="12" cy="20" rx="5" ry="2" fill="currentColor" opacity="0.15" />
      <path d="M8 19.5c.5 1 2 1.5 4 1.5s3.5-.5 4-1.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <defs>
        <linearGradient id="crystalGrad" x1="4" y1="2" x2="20" y2="18">
          <stop offset="0%" stopColor="#cfe5ff" />
          <stop offset="100%" stopColor="#66abff" />
        </linearGradient>
      </defs>
      {/* inner stars */}
      <path d="M10 7.5l.4 1.2 1.2.4-1.2.4-.4 1.2-.4-1.2-1.2-.4 1.2-.4.4-1.2z" fill="white" opacity="0.7" />
      <circle cx="15" cy="11" r="0.6" fill="white" opacity="0.5" />
      <circle cx="9" cy="13" r="0.4" fill="white" opacity="0.4" />
      {/* highlight */}
      <path d="M8 5c1.5-1 4-1.2 6-.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity="0.6" />
    </svg>
  );
}

// ============ Solo Mode Category Icons ============

// Replaces 🎯 (target / by mood)
export function IconTarget({ size, className, ...props }) {
  return (
    <IconBase size={size} className={className} {...props}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="6" />
      <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
    </IconBase>
  );
}

// Replaces 🧭 (compass / explore)
export function IconCompass({ size, className, ...props }) {
  return (
    <IconBase size={size} className={className} {...props}>
      <circle cx="12" cy="12" r="9" />
      <polygon points="12,5 14,11 12,19 10,11" fill="currentColor" opacity="0.8" />
      <polygon points="12,5 10,11 12,19 14,11" fill="none" opacity="0.4" />
      <circle cx="12" cy="12" r="1.5" />
    </IconBase>
  );
}

// ============ Solo Mode Scenario Icons ============

// Replaces 🎉 (treat / celebrate)
export function IconCelebrate({ size, className, ...props }) {
  return (
    <IconBaseFill size={size} className={className} {...props}>
      <path d="M12 2l1.5 4 4 1.5-4 1.5L12 13l-1.5-4-4-1.5 4-1.5L12 2z" />
      <path d="M3 9l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2z" opacity="0.7" />
      <path d="M19 7l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7.7-1.8z" opacity="0.6" />
      <path d="M6 16l.5 1.3 1.3.5-1.3.5-.5 1.3-.5-1.3-1.3-.5 1.3-.5.5-1.3z" opacity="0.5" />
    </IconBaseFill>
  );
}

// Replaces 😮‍💨 (tired / exhausted)
export function IconTired({ size, className, ...props }) {
  return (
    <IconBase size={size} className={className} {...props}>
      <circle cx="12" cy="9" r="6" />
      <path d="M6.5 15a6.5 6.5 0 0 1 11 0" />
      <path d="M9 7.5c1 .5 2 .5 3 0" />
      <path d="M13 7.5c1 .5 2 .5 3 0" />
      <circle cx="10" cy="10" r="0.6" fill="currentColor" stroke="none" />
      <circle cx="14" cy="10" r="0.6" fill="currentColor" stroke="none" />
      {/* sweat / steam lines */}
      <path d="M7 14c0 2 2.2 3.5 5 3.5s5-1.5 5-3.5" />
      <path d="M17 6c.5-.5.8-1 .6-1.5" />
      <path d="M19 7.5c.3-.3.5-.8.3-1.2" />
      <path d="M4 17c0 1.8 3.6 3 8 3s8-1.2 8-3" />
    </IconBase>
  );
}

// Replaces 🥗 (salad / light food)
export function IconSalad({ size, className, ...props }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" className={className} {...props}>
      {/* bowl */}
      <path d="M3 13h18c0 5-4 8-9 8s-9-3-9-8z" fill="#f0e6d0" stroke="#2D2A22" strokeWidth="1.5" />
      <path d="M2 13h20" stroke="#2D2A22" strokeWidth="1.5" />
      {/* lettuce leaves */}
      <path d="M5 11c1-2 3-2.5 4.5-1.5" fill="#6BCB77" stroke="#3d994a" strokeWidth="1" />
      <path d="M9 10c1.5-1.5 4-1 5 .5" fill="#8ce098" stroke="#5ab867" strokeWidth="1" />
      <path d="M14 9.5c1.5-1 3.5-.5 4.5 1" fill="#4daf5a" stroke="#358040" strokeWidth="1" />
      <path d="M7 9c.5-1.5 2-2 3-1" fill="#a8e6b1" stroke="#70c27d" strokeWidth="1" />
      {/* tomato chunks */}
      <circle cx="9" cy="14" r="1.3" fill="#ff6b6b" stroke="#cc441a" strokeWidth="0.6" />
      <circle cx="14.5" cy="14.5" r="1.1" fill="#ff6b6b" stroke="#cc441a" strokeWidth="0.6" />
      {/* corn */}
      <circle cx="11" cy="16" r="0.6" fill="#FFC93C" />
      <circle cx="12.5" cy="15.5" r="0.6" fill="#FFC93C" />
      <circle cx="13" cy="16.5" r="0.6" fill="#FFC93C" />
      <circle cx="11.5" cy="17" r="0.6" fill="#FFC93C" />
      {/* cucumber */}
      <ellipse cx="16" cy="16" rx="1.2" ry="0.7" fill="#6BCB77" stroke="#3d994a" strokeWidth="0.5" transform="rotate(20 16 16)" />
      <ellipse cx="7.5" cy="15.5" rx="1" ry="0.6" fill="#8ce098" stroke="#5ab867" strokeWidth="0.5" transform="rotate(-15 7.5 15.5)" />
    </svg>
  );
}

// Replaces 🍔 (burger / indulge)
export function IconBurger({ size, className, ...props }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" className={className} {...props}>
      {/* top bun */}
      <path d="M4 10c0-3.3 3.6-6 8-6s8 2.7 8 6H4z" fill="#f0c060" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4 10c0-3.3 3.6-6 8-6s8 2.7 8 6" stroke="currentColor" strokeWidth="1.5" fill="none" />
      {/* sesame seeds */}
      <circle cx="10" cy="7" r="0.7" fill="white" opacity="0.7" />
      <circle cx="14" cy="7.5" r="0.6" fill="white" opacity="0.7" />
      <circle cx="12" cy="5.5" r="0.5" fill="white" opacity="0.6" />
      {/* lettuce */}
      <path d="M3.5 10.5c1-.8 2.5 0 3.5-.5s2-.2 3 .5 2-.5 3 0 2.5-.3 3.5.5c.5.3.5 1.5 0 1.8H3.5c-.5-.3-.5-1.5 0-1.8z" fill="#34c759" stroke="none" />
      {/* patty */}
      <rect x="3" y="12" width="18" height="3.5" rx="1.5" fill="#a0522d" stroke="currentColor" strokeWidth="1" />
      {/* cheese */}
      <path d="M3 12l2-1.5h14l2 1.5" fill="#ffc107" stroke="none" />
      <path d="M15 10.5l-1 1.5" stroke="#f0a000" strokeWidth="0.5" />
      {/* bottom bun */}
      <path d="M3.5 15.5h17c.3 0 .5 1 .3 1.5-.8 2-4 3.5-8.8 3.5S4.2 19 3.8 17c-.2-.5 0-1.5.3-1.5z" fill="#e8b84a" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

// Replaces 🍲 (hotpot / cold weather)
export function IconHotpot({ size, className, ...props }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" className={className} {...props}>
      <path d="M3 12c0 4.5 4 8 9 8s9-3.5 9-8H3z" fill="#f0e6d0" stroke="#2D2A22" strokeWidth="1.5" />
      <path d="M3 12h18" stroke="#2D2A22" strokeWidth="1.5" />
      <path d="M5 12c0-2 3.1-3.5 7-3.5s7 1.5 7 3.5" fill="#2D2A22" opacity="0.1" />
      <circle cx="12" cy="9.5" r="1.5" fill="#2D2A22" opacity="0.2" />
      <path d="M9 6.5c0-1 .5-2 0-3" stroke="#2D2A22" strokeWidth="1" fill="none" opacity="0.3" />
      <path d="M12 5.5c0-1 .5-2 0-3" stroke="#2D2A22" strokeWidth="1" fill="none" opacity="0.3" />
      <path d="M15 6.5c0-1 .5-2 0-3" stroke="#2D2A22" strokeWidth="1" fill="none" opacity="0.3" />
      <path d="M1 14c1-1 2 0 2 1" stroke="#2D2A22" strokeWidth="1.5" fill="none" />
      <path d="M23 14c-1-1-2 0-2 1" stroke="#2D2A22" strokeWidth="1.5" fill="none" />
      <path d="M7 16c1 0 3 0 5 0" stroke="#cc0000" strokeWidth="1" fill="none" opacity="0.5" />
      <circle cx="14" cy="15" r="1" fill="#ff6b6b" opacity="0.6" />
      <circle cx="10" cy="17" r="0.8" fill="#ff9f0a" opacity="0.6" />
    </svg>
  );
}

// ============ Explore Distance Icons ============

// Replaces 🏠 (home / nearby)
export function IconHome({ size, className, ...props }) {
  return (
    <IconBase size={size} className={className} {...props}>
      <path d="M3 12l9-8 9 8" />
      <path d="M5 10v9a1 1 0 0 0 1 1h3v-5h6v5h3a1 1 0 0 0 1-1v-9" />
    </IconBase>
  );
}

// Replaces 🚶 (walking)
export function IconWalk({ size, className, ...props }) {
  return (
    <IconBase size={size} className={className} {...props}>
      <circle cx="12" cy="4" r="2" />
      <path d="M10 8h4l1 4-2 3v5" />
      <path d="M14 8l-2 4" />
      <path d="M8 20l2-5 2 1" />
      <path d="M13 15l2 5" />
    </IconBase>
  );
}

// Replaces 🚲 (bicycle)
export function IconBicycle({ size, className, ...props }) {
  return (
    <IconBase size={size} className={className} {...props}>
      <circle cx="6" cy="16" r="3.5" />
      <circle cx="18" cy="16" r="3.5" />
      <path d="M6 16l4-7h4" />
      <path d="M10 9l3 7" />
      <path d="M14 9l4 7" />
      <path d="M13 16h5" />
      <path d="M10 9h2" />
    </IconBase>
  );
}

// Replaces 🚀 (rocket / anywhere)
export function IconRocket({ size, className, ...props }) {
  return (
    <IconBaseFill size={size} className={className} {...props}>
      <path d="M12 2c-2 4-3 8-3 12h6c0-4-1-8-3-12z" opacity="0.9" />
      <path d="M9 14c-2 0-4 1-4 3h4" opacity="0.6" />
      <path d="M15 14c2 0 4 1 4 3h-4" opacity="0.6" />
      <circle cx="12" cy="10" r="1.5" fill="white" />
      <path d="M10 18l-1 4 3-2 3 2-1-4" opacity="0.5" />
      <path d="M11 20c.5.8 1.5.8 2 0" stroke="currentColor" strokeWidth="0.8" fill="none" />
    </IconBaseFill>
  );
}

// ============ Fortune Card Food Icons ============

// Replaces 🌶️ (spicy)
export function IconChili({ size, className, ...props }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" className={className} {...props}>
      <path d="M10 4c-3 1-6 5-5 10s4 7 6 7 3-1 3-1" fill="#ff3b30" stroke="#cc0000" strokeWidth="1.2" />
      <path d="M10 4c1.5-1 3-1 4 0" stroke="#34c759" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M14 4c.5.5 1 1.5.5 2" stroke="#34c759" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <path d="M6 11c.5 0 1 .3 1.5 0s1-.8 1.5-.5" stroke="#cc0000" strokeWidth="0.8" fill="none" opacity="0.5" />
    </svg>
  );
}

// Replaces 🍜 (noodles)
export function IconNoodles({ size, className, ...props }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" className={className} {...props}>
      {/* bowl */}
      <path d="M3 10h18c0 6-4 10-9 10S3 16 3 10z" fill="#f0e6d0" stroke="currentColor" strokeWidth="1.5" />
      {/* rim */}
      <path d="M2 10h20" stroke="currentColor" strokeWidth="1.5" />
      {/* noodles */}
      <path d="M7 9c0-3 1-5 2-6" stroke="#f0c060" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <path d="M10 8.5c0-2.5 1-4.5 2-5.5" stroke="#f0c060" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <path d="M13 9c0-3 1-5 2-6" stroke="#f0c060" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <path d="M16 8.5c0-2.5.8-4.5 1.5-5.5" stroke="#f0c060" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      {/* steam */}
      <path d="M8 3c.3-.8 0-1.5-.2-2" stroke="currentColor" strokeWidth="0.8" fill="none" opacity="0.3" />
      <path d="M12 2.5c.3-.8 0-1.5-.2-2" stroke="currentColor" strokeWidth="0.8" fill="none" opacity="0.3" />
    </svg>
  );
}

// Replaces 🍖 (meat) - 肉排/牛排
export function IconMeat({ size, className, ...props }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" className={className} {...props}>
      {/* 肉排主体 - 不规则形状 */}
      <path d="M4 14c0-3.5 2.5-7 6.5-7.5 1.5-0.2 3 0 4.5 0.5 2 0.8 4 2.5 4.5 5 0.3 1.5 0 3-1 4-1.2 1.2-3 1.5-5 1.5-3 0-6-0.5-8-2-1.5-1.2-2-2.5-2-2z" 
        fill="#c0523a" stroke="#8b3a28" strokeWidth="1.3" strokeLinejoin="round" />
      {/* 脂肪纹理 - 白色大理石花纹 */}
      <path d="M7 12c1.5 0.5 3-0.5 4.5 0s2 1.5 3.5 1" stroke="#f5e6d0" strokeWidth="1" fill="none" strokeLinecap="round" opacity="0.8" />
      <path d="M6 15c2 0.3 3.5-0.8 5-0.5s2 1 3.5 0.8" stroke="#f5e6d0" strokeWidth="0.8" fill="none" strokeLinecap="round" opacity="0.6" />
      <path d="M9 9.5c1 0.5 2-0.3 3 0.2" stroke="#f5e6d0" strokeWidth="0.7" fill="none" strokeLinecap="round" opacity="0.5" />
      {/* 烤痕 */}
      <path d="M8 10.5l2 2.5" stroke="#6b2818" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
      <path d="M12 9l1.5 3" stroke="#6b2818" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
      <path d="M16 10l1 2.5" stroke="#6b2818" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
      <path d="M10 14l2 2" stroke="#6b2818" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
      <path d="M14 13.5l1.5 2" stroke="#6b2818" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
      {/* 高光 */}
      <ellipse cx="8.5" cy="11" rx="1.5" ry="0.8" fill="#ffffff" opacity="0.25" transform="rotate(-20 8.5 11)" />
    </svg>
  );
}

// Replaces 🍰 (cake / sweet)
export function IconCake({ size, className, ...props }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" className={className} {...props}>
      {/* plate */}
      <ellipse cx="12" cy="21" rx="9" ry="2" fill="currentColor" opacity="0.1" />
      {/* cake body */}
      <rect x="4" y="12" width="16" height="8" rx="2" fill="#fce4c8" stroke="currentColor" strokeWidth="1.3" />
      {/* cream layer */}
      <path d="M4 15h16" stroke="currentColor" strokeWidth="0.8" opacity="0.3" />
      {/* frosting top */}
      <path d="M4 12c1-1.5 3-1 4 0s3-1.5 4 0 3-1 4 0 3-1.5 4 0" fill="#ff9f0a" stroke="none" />
      {/* candle */}
      <rect x="11" y="6" width="2" height="6" rx="0.5" fill="#ff6b6b" stroke="currentColor" strokeWidth="0.8" />
      {/* flame */}
      <path d="M12 2c.8 1.2.8 3 0 4-.8-1.2-.8-3 0-4z" fill="#ffcc00" />
    </svg>
  );
}

// Replaces 🦐 (shrimp / seafood)
export function IconShrimp({ size, className, ...props }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" className={className} {...props}>
      <path d="M6 8c2-3 8-3 12 0l2 6c-2 4-6 6-10 5-3-1-5-3-5-5V8z" fill="#f08080" stroke="#d05050" strokeWidth="1.2" />
      <path d="M5 14c-1 0-2 1-2 2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <path d="M7 15c-1 .5-1.5 1.5-1 2.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      <path d="M9 15.5c-.5.8-.3 1.8.5 2.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
      {/* eye */}
      <circle cx="15" cy="9" r="1" fill="white" />
      <circle cx="15.3" cy="9" r="0.5" fill="currentColor" />
      {/* segments */}
      <path d="M8 10c2 0 6 0 10 0" stroke="#d05050" strokeWidth="0.6" opacity="0.4" />
      <path d="M7 12c2 0 7 0 11 0" stroke="#d05050" strokeWidth="0.6" opacity="0.4" />
    </svg>
  );
}

// Replaces 🥣 (congee / warm)
export function IconCongee({ size, className, ...props }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" className={className} {...props}>
      {/* bowl */}
      <path d="M3 12h18c0 5.5-4 9.5-9 9.5S3 17.5 3 12z" fill="#f5f0e0" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2 12h20" stroke="currentColor" strokeWidth="1.5" />
      {/* contents */}
      <circle cx="9" cy="16" r="1" fill="currentColor" opacity="0.2" />
      <circle cx="13" cy="17" r="0.8" fill="currentColor" opacity="0.2" />
      <circle cx="11" cy="14.5" r="0.6" fill="currentColor" opacity="0.15" />
      {/* steam */}
      <path d="M8 8c.5-1.5 0-3-.5-4" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.3" />
      <path d="M12 7c.5-1.5 0-3-.5-4" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.3" />
      <path d="M16 8c.5-1.5 0-3-.5-4" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.3" />
    </svg>
  );
}

// Replaces 🌴 (exotic / tropical) - 地球
export function IconTropical({ size, className, ...props }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" className={className} {...props}>
      {/* 地球主体 */}
      <circle cx="12" cy="12" r="9" fill="#2D9CDB" stroke="#2D2A22" strokeWidth="1.5" />
      {/* 北美洲 */}
      <path d="M7 7c1-2 3-3 5-2 1 1 1 2 0 3-1 2-2 3-3 2-2-1-3-2-2-3z" fill="#6BCB77" stroke="#3d994a" strokeWidth="0.8" />
      {/* 南美洲 */}
      <path d="M10 12c0 1-1 2-1 3.5 0 1.5 1 2.5 2 2 1-0.5 2-2 1.5-3.5-0.5-1.5-1.5-2.5-2.5-2z" fill="#8ce098" stroke="#5ab867" strokeWidth="0.8" />
      {/* 欧洲/非洲 */}
      <path d="M14 8c1-1 2.5-0.5 3 0.5 1 2 0.5 3.5-0.5 4-1.5 1-3 0-3.5-1.5s-0.5-2 1-3z" fill="#FFC93C" stroke="#d4a000" strokeWidth="0.8" />
      {/* 亚洲 */}
      <path d="M16 6c1.5-0.5 3 0.5 3.5 2 0.5 1.5 0 3-1 3.5-1.5 1-3.5 0-4-2s0-3 1.5-3.5z" fill="#f08080" stroke="#d05050" strokeWidth="0.8" />
      {/* 大洋洲 */}
      <ellipse cx="18" cy="17" rx="1.5" ry="1" fill="#FF6B3D" stroke="#cc441a" strokeWidth="0.7" />
      {/* 经纬线 */}
      <ellipse cx="12" cy="12" rx="9" ry="3" fill="none" stroke="#ffffff" strokeWidth="0.5" opacity="0.4" />
      <line x1="12" y1="3" x2="12" y2="21" stroke="#ffffff" strokeWidth="0.5" opacity="0.4" />
    </svg>
  );
}

// Replaces 🍢 (street food / skewers)
export function IconSkewer({ size, className, ...props }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" className={className} {...props}>
      <line x1="4" y1="20" x2="20" y2="4" stroke="#2D2A22" strokeWidth="1.5" />
      <ellipse cx="9" cy="15" rx="2.5" ry="2" transform="rotate(-45 9 15)" fill="#f08080" stroke="#d05050" strokeWidth="1" />
      <ellipse cx="13" cy="11" rx="2.5" ry="2" transform="rotate(-45 13 11)" fill="#c0523a" stroke="#8b3a28" strokeWidth="1" />
      <ellipse cx="17" cy="7" rx="2.5" ry="2" transform="rotate(-45 17 7)" fill="#ff9f0a" stroke="#cc7700" strokeWidth="1" />
      <circle cx="7" cy="17" r="1" fill="#2D2A22" opacity="0.3" />
      <circle cx="19" cy="5" r="1" fill="#2D2A22" opacity="0.2" />
    </svg>
  );
}

// Replaces 🍣 (sushi)
export function IconSushi({ size, className, ...props }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" className={className} {...props}>
      {/* plate */}
      <ellipse cx="12" cy="18" rx="9" ry="3" fill="currentColor" opacity="0.08" />
      {/* sushi 1 */}
      <rect x="3" y="10" width="5.5" height="5" rx="2" fill="#f5f0e0" stroke="currentColor" strokeWidth="1" />
      <rect x="3" y="8.5" width="5.5" height="2.5" rx="1.2" fill="#ff6b6b" />
      {/* sushi 2 */}
      <rect x="9.5" y="10" width="5.5" height="5" rx="2" fill="#f5f0e0" stroke="currentColor" strokeWidth="1" />
      <rect x="9.5" y="8.5" width="5.5" height="2.5" rx="1.2" fill="#f08080" />
      {/* sushi 3 */}
      <rect x="16" y="10" width="5.5" height="5" rx="2" fill="#f5f0e0" stroke="currentColor" strokeWidth="1" />
      <rect x="16" y="8.5" width="5.5" height="2.5" rx="1.2" fill="#ff9f0a" />
      {/* nori wrap lines */}
      <line x1="3.5" y1="10.5" x2="8" y2="10.5" stroke="currentColor" strokeWidth="0.5" opacity="0.2" />
      <line x1="10" y1="10.5" x2="14.5" y2="10.5" stroke="currentColor" strokeWidth="0.5" opacity="0.2" />
      <line x1="16.5" y1="10.5" x2="21" y2="10.5" stroke="currentColor" strokeWidth="0.5" opacity="0.2" />
    </svg>
  );
}

// Replaces ☕ (coffee)
export function IconCoffee({ size, className, ...props }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" className={className} {...props}>
      {/* cup */}
      <path d="M4 8h12v10c0 2-2.7 3.5-6 3.5S4 20 4 18V8z" fill="#f5f0e0" stroke="currentColor" strokeWidth="1.5" />
      {/* handle */}
      <path d="M16 10c1.5 0 3 1.2 3 3s-1.5 3-3 3" stroke="currentColor" strokeWidth="1.5" fill="none" />
      {/* saucer */}
      <path d="M2 20h16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      {/* steam */}
      <path d="M7 5c.3-1 0-2-.3-3" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.3" />
      <path d="M10 4c.3-1 0-2-.3-3" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.3" />
      <path d="M13 5c.3-1 0-2-.3-3" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.3" />
    </svg>
  );
}

// Replaces 🔥 (fire / BBQ) - 烧烤串
export function IconFire({ size, className, ...props }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" className={className} {...props}>
      {/* 竹签 */}
      <line x1="5" y1="19" x2="19" y2="5" stroke="#8B5A2B" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="6" y1="20" x2="20" y2="6" stroke="#2D2A22" strokeWidth="1" strokeLinecap="round" opacity="0.3" />
      {/* 肉块 */}
      <ellipse cx="8" cy="16" rx="2.5" ry="2" transform="rotate(-45 8 16)" fill="#c0523a" stroke="#8b3a28" strokeWidth="1.2" />
      <ellipse cx="12" cy="12" rx="2.5" ry="2" transform="rotate(-45 12 12)" fill="#a04030" stroke="#6b2818" strokeWidth="1.2" />
      <ellipse cx="16" cy="8" rx="2.5" ry="2" transform="rotate(-45 16 8)" fill="#c0523a" stroke="#8b3a28" strokeWidth="1.2" />
      {/* 烤痕 */}
      <line x1="7" y1="17" x2="9" y2="15" stroke="#2D2A22" strokeWidth="0.6" opacity="0.4" />
      <line x1="11" y1="13" x2="13" y2="11" stroke="#2D2A22" strokeWidth="0.6" opacity="0.4" />
      <line x1="15" y1="9" x2="17" y2="7" stroke="#2D2A22" strokeWidth="0.6" opacity="0.4" />
      {/* 油光高光 */}
      <ellipse cx="7.5" cy="15.5" rx="0.8" ry="0.5" fill="#ffffff" opacity="0.3" transform="rotate(-45 7.5 15.5)" />
      <ellipse cx="15.5" cy="7.5" rx="0.8" ry="0.5" fill="#ffffff" opacity="0.3" transform="rotate(-45 15.5 7.5)" />
    </svg>
  );
}

// Replaces 🥬 (veggie)
export function IconVeggie({ size, className, ...props }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" className={className} {...props}>
      <path d="M12 22V10" stroke="#2D2A22" strokeWidth="2" />
      <path d="M12 10c-3 0-7 2-8 6 3-1.5 5.5-1.5 8-3z" fill="#6BCB77" stroke="#3d994a" strokeWidth="1.2" />
      <path d="M12 10c3 0 7 2 8 6-3-1.5-5.5-1.5-8-3z" fill="#8ce098" stroke="#5ab867" strokeWidth="1.2" />
      <path d="M12 7c-1-3 0-7 3-7-1 2.5-.5 5-1 7z" fill="#4daf5a" stroke="#358040" strokeWidth="1" />
      <path d="M12 7c1-3 2-6 0-7 0 2.5-1 5-2 7z" fill="#a8e6b1" stroke="#70c27d" strokeWidth="1" />
      <circle cx="10" cy="16" r="1" fill="#ffffff" opacity="0.3" />
      <circle cx="14" cy="14" r="0.8" fill="#ffffff" opacity="0.2" />
    </svg>
  );
}

// ============ Utility ============

// Replaces ✨ (sparkles in text)
export function IconSparkles({ size, className, ...props }) {
  return (
    <IconBaseFill size={size} className={className} {...props}>
      <path d="M12 1l1.2 3.8L17 6l-3.8 1.2L12 11l-1.2-3.8L7 6l3.8-1.2L12 1z" />
      <path d="M5 14l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2z" opacity="0.6" />
      <path d="M19 16l.5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5-1.5-.5 1.5-.5.5-1.5z" opacity="0.5" />
    </IconBaseFill>
  );
}

// Replaces 💡 (idea)
export function IconIdea({ size, className, ...props }) {
  return (
    <IconBase size={size} className={className} {...props}>
      <path d="M9 18h6" />
      <path d="M10 20h4" />
      <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />
      <path d="M10 13h4" opacity="0.3" />
    </IconBase>
  );
}

// Convenience map: emoji → component
export const EMOJI_ICON_MAP = {
  '🎯': IconTarget,
  '🧭': IconCompass,
  '🔮': IconCrystalBall,
  '🎉': IconCelebrate,
  '😮‍💨': IconTired,
  '🥗': IconSalad,
  '🍔': IconBurger,
  '🍲': IconHotpot,
  '🏠': IconHome,
  '🚶': IconWalk,
  '🚲': IconBicycle,
  '🚀': IconRocket,
  '🌶️': IconChili,
  '🌶': IconChili,
  '🍜': IconNoodles,
  '🍖': IconMeat,
  '🍰': IconCake,
  '🦐': IconShrimp,
  '🥣': IconCongee,
  '🌴': IconTropical,
  '🍢': IconSkewer,
  '🍣': IconSushi,
  '☕': IconCoffee,
  '🔥': IconFire,
  '🥬': IconVeggie,
  '🎲': IconDice,
  '🌟': IconSparkle,
  '✨': IconSparkles,
  '💡': IconIdea,
};

/**
 * Renders the appropriate SVG icon for a given emoji string.
 * Falls back to rendering the original emoji if no mapping exists.
 */
export function EmojiToIcon({ emoji, size, className, ...props }) {
  const IconComponent = EMOJI_ICON_MAP[emoji];
  if (IconComponent) {
    return <IconComponent size={size} className={className} {...props} />;
  }
  return <span style={{ fontSize: size || 24 }} className={className} {...props}>{emoji}</span>;
}

export default EMOJI_ICON_MAP;

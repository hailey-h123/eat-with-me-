import { useState, useEffect } from 'react';
import { IconHome, IconHistory, IconUser } from './icons/FancyIcons';

/**
 * 3 Tab 底部导航：首页 / 足迹 / 我的
 * 受控组件：activeView + onChange，由 App.jsx 持有路由状态
 * 三个图标统一为 24×24 描边风格（strokeWidth 1.7），保证视觉对齐
 */
const TABS = [
  { id: 'home', label: '首页', icon: IconHome },
  { id: 'footprint', label: '足迹', icon: IconHistory },
  { id: 'profile', label: '我的', icon: IconUser },
];

export default function TabBar({ activeView, onChange }) {
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

  return (
    <nav
      className="border-t-2 flex-shrink-0"
      style={{
        borderColor: 'var(--color-ink)',
        background: 'rgba(255,251,240,0.92)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
      aria-label="主导航"
    >
      <div className="max-w-2xl mx-auto flex items-stretch">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const active = activeView === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              aria-current={active ? 'page' : undefined}
              className={`flex-1 flex flex-col items-center gap-0.5 transition-all ${
                isNarrow ? 'py-1.5' : 'py-2.5'
              } ${active ? 'text-primary' : 'text-text-secondary hover:text-text'}`}
              style={{ fontFamily: 'var(--font-display)' }}
            >
              <span
                className={`flex items-center justify-center rounded-xl transition-all ${
                  isNarrow ? 'w-8 h-6' : 'w-10 h-8'
                } ${active ? 'bg-primary/12 scale-105' : ''}`}
              >
                <Icon className={isNarrow ? 'w-4 h-4' : 'w-5 h-5'} />
              </span>
              <span className={`leading-none ${active ? 'font-extrabold' : 'font-bold'} ${isNarrow ? 'text-[10px]' : 'text-[11px]'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

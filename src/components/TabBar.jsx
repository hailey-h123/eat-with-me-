import { IconLogo, IconHistory, IconUser } from './icons/FancyIcons';

/**
 * 3 Tab 底部导航：首页 / 足迹 / 我的
 * 受控组件：activeView + onChange，由 App.jsx 持有路由状态
 */
const TABS = [
  { id: 'home', label: '首页', icon: IconLogo },
  { id: 'footprint', label: '足迹', icon: IconHistory },
  { id: 'profile', label: '我的', icon: IconUser },
];

export default function TabBar({ activeView, onChange }) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 glass-header border-t-2"
      style={{ borderColor: 'var(--color-ink)' }}
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
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-all ${
                active ? 'text-primary' : 'text-text-secondary hover:text-text'
              }`}
              style={{ fontFamily: 'var(--font-display)' }}
            >
              <span
                className={`flex items-center justify-center w-10 h-8 rounded-xl transition-all ${
                  active ? 'bg-primary/12 scale-105' : ''
                }`}
              >
                <Icon className="w-5 h-5" />
              </span>
              <span className={`text-[11px] leading-none ${active ? 'font-extrabold' : 'font-bold'}`}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

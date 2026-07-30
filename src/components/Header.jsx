import { IconLogo, IconArrowLeft } from './icons/FancyIcons';
import { useTranslation } from '../i18n';

export default function Header({
  title = '吃什么',
  subtitle = 'AI 用餐决策助手',
  showBack = false,
  onBack
}) {
  const { lang, toggleLang } = useTranslation();

  return (
    <header className="glass-header py-4">
      <div className="max-w-2xl mx-auto px-6 flex items-center gap-4">
        {showBack && (
          <button
            type="button"
            onClick={onBack}
            className="p-3 -ml-3 text-primary hover:text-primary-dark rounded-xl transition-all duration-300 flex-shrink-0 hover:bg-primary/5 hover:scale-110"
          >
            <IconArrowLeft className="w-6 h-6" />
          </button>
        )}
        <div className="flex items-center gap-3">
          <div className="relative w-12 h-12 flex-shrink-0">
            <div className="absolute inset-0 bg-gradient-to-br from-primary to-accent rounded-xl opacity-20 animate-pulse-glow" />
            <div className="relative w-full h-full bg-gradient-to-br from-primary via-primary-dark to-orange-600 rounded-xl flex items-center justify-center shadow-lg icon-glow">
              <IconLogo className="w-6 h-6" />
            </div>
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-accent rounded-full flex items-center justify-center shadow-sm">
              <span className="text-[8px] font-bold text-primary-dark">AI</span>
            </div>
          </div>
          <div>
            <h1 className="text-xl font-bold text-text tracking-tight leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs text-text-secondary leading-tight mt-0.5 font-medium">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={toggleLang}
            className="relative w-12 h-6 rounded-full border-2 transition-colors duration-300 overflow-hidden flex-shrink-0"
            style={{
              borderColor: 'var(--color-ink)',
              backgroundColor: lang === 'zh' ? 'var(--color-bg-soft)' : 'var(--color-bg-soft)',
            }}
          >
            <span className="absolute inset-0 flex items-center justify-between px-1.5 pointer-events-none">
              <span className="text-[9px] font-extrabold text-ink leading-none">中</span>
              <span className="text-[9px] font-extrabold text-ink leading-none">EN</span>
            </span>
            <span
              className={`absolute top-0.5 h-4 w-5 rounded-full bg-primary shadow-md transition-all duration-300 ease-out ${
                lang === 'zh' ? 'left-0.5' : 'left-[calc(100%-1.375rem)]'
              }`}
            />
          </button>
          <div className="w-2 h-2 bg-secondary rounded-full animate-pulse" />
          <span className="text-[10px] text-text-muted font-medium">AI 就绪</span>
        </div>
      </div>
    </header>
  );
}

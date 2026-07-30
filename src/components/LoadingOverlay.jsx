import Mascot, { FoodDecor } from './Mascot';

export default function LoadingOverlay({ message = '正在为你挑餐厅...', subMessage = '' }) {
  return (
    <div className="fixed inset-0 bg-bg/95 flex flex-col items-center justify-center z-50 fade-in">
      <div className="relative">
        <Mascot mood="expect" size={90} />
        <div className="absolute -top-2 -right-2">
          <FoodDecor type="sparkle" size={18} className="float-animation opacity-80" style={{ animationDelay: '0.2s' }} />
        </div>
        <div className="absolute -bottom-1 -left-3">
          <FoodDecor type="star" size={14} className="float-animation opacity-70" style={{ animationDelay: '0.8s' }} />
        </div>
        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
          <FoodDecor type="heart" size={12} className="float-animation opacity-60" style={{ animationDelay: '1.2s' }} />
        </div>
      </div>
      <p className="mt-6 font-extrabold text-xl text-text" style={{ fontFamily: 'var(--font-display)' }}>
        {message}
      </p>
      {subMessage && (
        <p className="mt-2 text-sm text-text-muted">
          {subMessage} ✨
        </p>
      )}
      <div className="mt-8 flex gap-3">
        <FoodDecor type="noodle" size={22} className="bounce-in opacity-60" style={{ animationDelay: '0s' }} />
        <FoodDecor type="chili" size={20} className="bounce-in opacity-60" style={{ animationDelay: '0.15s' }} />
        <FoodDecor type="egg" size={20} className="bounce-in opacity-60" style={{ animationDelay: '0.3s' }} />
        <FoodDecor type="sparkle" size={18} className="bounce-in opacity-70" style={{ animationDelay: '0.45s' }} />
        <FoodDecor type="heart" size={16} className="bounce-in opacity-60" style={{ animationDelay: '0.6s' }} />
      </div>
    </div>
  );
}

import { useState, useRef, useEffect } from 'react';
import { drawFortuneCard, FORTUNE_CARDS } from '../services/recommendationService';
import Mascot, { FoodDecor } from './Mascot';

export default function FortuneDrawView({ onCardDrawn, onBack }) {
  const [spinKey, setSpinKey] = useState(0);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isSpinning, setIsSpinning] = useState(true);
  const [showResult, setShowResult] = useState(false);
  const [finalCard, setFinalCard] = useState(null);
  const intervalRef = useRef(null);
  const targetCard = useRef(null);

  const startSpin = () => {
    setIsSpinning(true);
    setShowResult(false);
    setFinalCard(null);
    targetCard.current = drawFortuneCard();
    let speed = 60;
    let elapsed = 0;
    const totalDuration = 2500;
    const tick = () => {
      setCurrentCardIndex(prev => (prev + 1) % FORTUNE_CARDS.length);
      elapsed += speed;
      if (elapsed > totalDuration * 0.5) speed = Math.min(speed * 1.18, 450);
      if (elapsed >= totalDuration) {
        clearTimeout(intervalRef.current);
        const finalIndex = FORTUNE_CARDS.findIndex(c => c.id === targetCard.current.id);
        setCurrentCardIndex(finalIndex >= 0 ? finalIndex : 0);
        setFinalCard(targetCard.current);
        setIsSpinning(false);
        setTimeout(() => setShowResult(true), 400);
        return;
      }
      intervalRef.current = setTimeout(tick, speed);
    };
    intervalRef.current = setTimeout(tick, speed);
  };

  useEffect(() => {
    startSpin();
    return () => { if (intervalRef.current) clearTimeout(intervalRef.current); };
  }, [spinKey]);

  const handleConfirm = () => { if (finalCard) onCardDrawn(finalCard); };
  const handleRedraw = () => { setSpinKey(k => k + 1); };
  const displayCard = FORTUNE_CARDS[currentCardIndex];

  return (
    <div className="max-w-lg w-full mx-auto px-4 sm:px-6 py-8 h-full flex flex-col items-center justify-center overflow-y-auto">
      <div className="relative">
        <Mascot mood={isSpinning ? 'expect' : 'surprise'} size={72} />
        <FoodDecor type="sparkle" size={14} className="pointer-events-none absolute -top-2 -left-3 float-animation opacity-70" style={{ animationDelay: '0.4s' }} />
        <FoodDecor type="star" size={12} className="pointer-events-none absolute -top-1 right-0 float-animation opacity-70" style={{ animationDelay: '1s' }} />
      </div>

      <h2 className="font-extrabold text-xl mt-2 mb-4 text-center" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-primary)' }}>
        {isSpinning ? '抽一张今日运势卡...' : '看看今天吃什么！'}
      </h2>

      <div className="relative">
        <FoodDecor type="star" size={16} className="absolute -top-3 left-2 float-animation" style={{ animationDelay: '0.3s' }} />
        <FoodDecor type="star" size={14} className="absolute -top-2 right-4 float-animation" style={{ animationDelay: '0.8s' }} />
        <FoodDecor type="sparkle" size={12} className="pointer-events-none absolute -bottom-2 -left-3 float-animation opacity-70" style={{ animationDelay: '1.3s' }} />
        <FoodDecor type="heart" size={12} className="pointer-events-none absolute -bottom-1 -right-3 float-animation opacity-70" style={{ animationDelay: '0.6s' }} />

        <div className="fancy-card p-6 sm:p-8">
          <div className="relative w-48 h-72 sm:w-56 sm:h-80">
            <div className={`absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl transition-all duration-300 ${showResult ? 'scale-100' : 'scale-95'}`}
              style={{
                background: 'linear-gradient(180deg, #FFF4DE 0%, #FFFFFF 100%)',
                border: '2.5px solid var(--color-ink)',
                boxShadow: isSpinning ? '4px 4px 0 var(--color-primary)' : '4px 4px 0 var(--color-ink)',
              }}>
              <div className="text-4xl sm:text-5xl">{displayCard.icon}</div>
              <div className="font-extrabold text-lg sm:text-xl text-text px-4 text-center" style={{ fontFamily: 'var(--font-display)' }}>
                {displayCard.label}
              </div>
              <div className="text-sm text-text-muted px-4 text-center leading-relaxed">
                {showResult ? displayCard.message : '...'}
              </div>
              {showResult && displayCard.keywords && (
                <div className="text-xs text-primary font-bold text-center animate-fade-in">
                  关键词：{displayCard.keywords.join('、')}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 flex flex-col items-center gap-3 w-full max-w-xs">
        {showResult ? (
          <>
            <button
              onClick={handleConfirm}
              className="btn-primary w-full py-3 text-base"
            >
              就按这个来！
            </button>
            <button
              onClick={handleRedraw}
              className="btn-secondary w-full py-2.5 text-sm"
            >
              再抽一张
            </button>
          </>
        ) : (
          <div className="text-text-muted text-sm animate-pulse">命运正在降临...</div>
        )}
      </div>

      <button
        onClick={onBack}
        className="mt-6 text-text-muted text-sm font-medium hover:text-primary transition-colors"
      >
        ← 返回首页
      </button>
    </div>
  );
}

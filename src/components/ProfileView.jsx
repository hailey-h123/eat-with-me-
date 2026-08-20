import { useState, useEffect, useMemo } from 'react';
import {
  IconStar, IconMapPin, IconChevronRight, IconSparkles, IconEdit2,
  IconComment, IconTrash2, IconInfo, IconSmile, IconMeh, IconFrown,
  IconTrophy, IconTarget, IconUsers, IconSolo,
} from './icons/FancyIcons';
import { EmojiToIcon, IconChili } from './icons/FoodIcons';
import { getFavorites, getVisited, getSearchHistory, getDecisionCount } from '../services/historyService';
import { computeLevel, computeTasteTags, computeBadges, countModes, getAvatar } from '../services/profileService';

export default function ProfileView({ location, onOpenFootprint }) {
  const [favorites, setFavorites] = useState([]);
  const [visited, setVisited] = useState([]);
  const [searchHistory, setSearchHistory] = useState([]);
  const [decisionCount, setDecisionCount] = useState(0);
  const [avatar] = useState(() => getAvatar());

  const refreshData = () => {
    setFavorites(getFavorites());
    setVisited(getVisited());
    setSearchHistory(getSearchHistory());
    setDecisionCount(getDecisionCount());
  };

  useEffect(() => { refreshData(); }, []);

  const level = useMemo(() => computeLevel(decisionCount), [decisionCount]);
  const tasteTags = useMemo(
    () => computeTasteTags(favorites, visited, searchHistory),
    [favorites, visited, searchHistory]
  );
  const badges = useMemo(() => {
    const { groupCount, soloCount } = countModes(searchHistory);
    return computeBadges({ favorites, visited, decisionCount, groupCount, soloCount });
  }, [favorites, visited, searchHistory, decisionCount]);

  const recentDecisions = visited.slice(0, 2);

  const handleClearData = () => {
    if (!window.confirm('确定清除所有本地数据吗？（收藏/去过/搜索历史/等级进度将全部清空，无法恢复）')) return;
    try {
      Object.keys(localStorage)
        .filter(key => key.startsWith('eatwithme_'))
        .forEach(key => localStorage.removeItem(key));
      window.location.reload();
    } catch {}
  };

  const formatTime = (ts) => {
    const d = new Date(ts);
    const now = new Date();
    const diff = now - d;
    if (diff < 86400000) return '今天';
    const days = Math.floor(diff / 86400000);
    if (days === 1) return '昨天';
    if (days < 7) return `${days}天前`;
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  };

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 h-full flex flex-col min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pb-3">
      {/* 1. 用户等级卡 */}
      <div
        className="relative overflow-hidden rounded-2xl p-4 border-2 shadow-[3px_3px_0_var(--color-ink)] text-center"
        style={{ borderColor: 'var(--color-ink)', background: 'linear-gradient(135deg, #FFF5D6 0%, #FFFBF0 60%, #FFEAB3 100%)' }}
      >
        <div className="flex justify-center items-center gap-2 mb-1.5">
          <EmojiToIcon emoji={avatar} size={36} className="text-primary" />
          <h3 className="text-lg font-extrabold text-text" style={{ fontFamily: 'var(--font-display)' }}>
            美食{level.title} · Lv.{level.level}
          </h3>
        </div>
        {/* 进度条（说明行同时承载"决定过 N 次"信息） */}
        <div className="max-w-xs mx-auto">
          <div className="h-2.5 rounded-full bg-white/70 border-2 overflow-hidden" style={{ borderColor: 'var(--color-ink)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.max(4, level.progress * 100)}%`, background: 'linear-gradient(90deg, var(--color-primary), var(--color-accent))' }}
            />
          </div>
          <p className="text-[11px] text-text-secondary mt-1 font-bold" style={{ fontFamily: 'var(--font-display)' }}>
            {level.isMax
              ? `已决定 ${level.current} 次 · 满级继续保持！`
              : `已决定 ${level.current} 次 · 还差 ${level.nextThreshold - level.current} 次升级 ${computeLevel(level.nextThreshold).title}`}
          </p>
        </div>
      </div>

      {/* 2+3. 口味偏好 & 最近的决定：2 列并排（一屏化） */}
      <div className="grid grid-cols-2 gap-3">
        <section className="fancy-card p-3">
          <h4 className="text-xs font-extrabold text-text flex items-center gap-1 mb-2" style={{ fontFamily: 'var(--font-display)' }}>
            <IconSparkles className="w-3.5 h-3.5 text-primary" /> 口味偏好
          </h4>
          {tasteTags.length === 0 ? (
            <p className="text-[10px] text-text-muted leading-relaxed">继续使用后 AI 自动生成口味画像</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {tasteTags.slice(0, 4).map((tag, i) => (
                <span key={`${tag.label}-${i}`} className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white border text-text-secondary" style={{ borderColor: 'var(--color-ink)' }}>
                  {tag.label}
                </span>
              ))}
            </div>
          )}
        </section>
        <section className="fancy-card p-3">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-extrabold text-text" style={{ fontFamily: 'var(--font-display)' }}>最近决定</h4>
            <button type="button" onClick={onOpenFootprint} className="text-[10px] text-primary font-bold flex items-center" style={{ fontFamily: 'var(--font-display)' }}>
              全部 <IconChevronRight className="w-2.5 h-2.5" />
            </button>
          </div>
          {recentDecisions.length === 0 ? (
            <p className="text-[10px] text-text-muted leading-relaxed">标记「去过」的餐厅会出现在这里</p>
          ) : (
            <div className="space-y-1.5">
              {recentDecisions.slice(0, 2).map(r => {
                const MoodIcon = r.mood === 'great' ? IconSmile : r.mood === 'ok' ? IconMeh : r.mood === 'bad' ? IconFrown : null;
                return (
                  <div key={r.id} className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: r.mood === 'bad' ? '#E8552A' : 'var(--color-secondary)' }} />
                    <p className="text-[11px] text-text truncate flex-1">{r.name}</p>
                    {MoodIcon && <MoodIcon className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* 4. 成就徽章：单行 4 格（一屏化，去掉占位格） */}
      <section className="fancy-card p-3">
        <h4 className="text-xs font-extrabold text-text mb-2" style={{ fontFamily: 'var(--font-display)' }}>成就徽章</h4>
        <div className="grid grid-cols-4 gap-2">
          {badges.map(badge => (
            <div key={badge.id}
              className={`flex flex-col items-center gap-1 py-1.5 rounded-lg border ${badge.unlocked ? 'bg-white' : 'bg-bg-soft opacity-50'}`}
              style={{ borderColor: 'var(--color-ink)' }}
              title={badge.desc}>
              <div className="flex items-center gap-1">
                {badge.id === 'decade' && <IconTarget className="w-5 h-5 text-primary" />}
                {badge.id === 'spicy' && <IconChili className="w-5 h-5" />}
                {badge.id === 'organizer' && <IconUsers className="w-5 h-5 text-secondary" />}
                {badge.id === 'solo' && <IconSolo className="w-5 h-5 text-primary" />}
              </div>
              <p className="text-[9px] font-extrabold text-text leading-none text-center" style={{ fontFamily: 'var(--font-display)' }}>{badge.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 5. 设置项：横排（一屏化） */}
      <section className="fancy-card p-2 flex items-stretch gap-2">
        <button type="button" className="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl hover:bg-bg-soft transition-colors text-text" style={{ fontFamily: 'var(--font-display)' }}>
          <IconComment className="w-4 h-4" />
          <span className="text-[10px] font-bold">联系我们</span>
        </button>
        <button type="button" onClick={handleClearData} className="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl hover:bg-bg-soft transition-colors text-error" style={{ fontFamily: 'var(--font-display)' }}>
          <IconTrash2 className="w-4 h-4" />
          <span className="text-[10px] font-bold">清除数据</span>
        </button>
        <button type="button" className="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl hover:bg-bg-soft transition-colors text-text" style={{ fontFamily: 'var(--font-display)' }}>
          <IconInfo className="w-4 h-4" />
          <span className="text-[10px] font-bold">关于</span>
        </button>
      </section>
      </div>
    </div>
  );
}

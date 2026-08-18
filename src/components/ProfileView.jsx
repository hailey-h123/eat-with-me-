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

  const recentDecisions = visited.slice(0, 3);

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
    <div className="max-w-lg mx-auto px-4 sm:px-6 space-y-5">
      {/* 1. 用户等级卡 */}
      <div
        className="relative overflow-hidden rounded-2xl p-6 border-2 shadow-[4px_4px_0_var(--color-ink)] text-center"
        style={{ borderColor: 'var(--color-ink)', background: 'linear-gradient(135deg, #FFF5D6 0%, #FFFBF0 60%, #FFEAB3 100%)' }}
      >
        <div className="flex justify-center mb-2">
          <EmojiToIcon emoji={avatar} size={56} className="text-primary" />
        </div>
        <h3 className="text-xl font-extrabold text-text mb-1" style={{ fontFamily: 'var(--font-display)' }}>
          美食{level.title} · Lv.{level.level}
        </h3>
        <p className="text-sm text-text-secondary mb-3" style={{ fontFamily: 'var(--font-display)' }}>
          决定过 {level.current} 次吃什么{location?.name ? ` · ${location.name}` : ''}
        </p>
        {/* 进度条 */}
        <div className="max-w-xs mx-auto">
          <div className="h-3 rounded-full bg-white/70 border-2 overflow-hidden" style={{ borderColor: 'var(--color-ink)' }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.max(4, level.progress * 100)}%`, background: 'linear-gradient(90deg, var(--color-primary), var(--color-accent))' }}
            />
          </div>
          <p className="text-xs text-text-secondary mt-1.5 font-bold" style={{ fontFamily: 'var(--font-display)' }}>
            {level.isMax
              ? '已满级，继续保持！'
              : `${level.current} / ${level.nextThreshold} 次 → 升级 Lv.${level.level + 1} ${computeLevel(level.nextThreshold).title}`}
          </p>
        </div>
      </div>

      {/* 2. 口味偏好标签云 */}
      <section className="fancy-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-extrabold text-text flex items-center gap-1.5" style={{ fontFamily: 'var(--font-display)' }}>
            <IconSparkles className="w-4 h-4 text-primary" /> 我的口味偏好
          </h4>
          <button type="button" className="text-xs text-primary font-bold flex items-center gap-1 hover:underline" style={{ fontFamily: 'var(--font-display)' }}>
            <IconEdit2 className="w-3 h-3" /> 修改
          </button>
        </div>
        {tasteTags.length === 0 ? (
          <p className="text-xs text-text-muted">
            继续使用后，AI 会根据你的收藏/搜索自动生成口味画像
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tasteTags.map((tag, i) => (
              <span
                key={`${tag.label}-${i}`}
                className="px-3 py-1 rounded-full text-xs font-bold bg-white border-2 text-text-secondary"
                style={{ borderColor: 'var(--color-ink)' }}
              >
                {tag.label}
              </span>
            ))}
          </div>
        )}
        <p className="text-[10px] text-text-muted mt-2.5">AI 根据收藏/搜索自动生成</p>
      </section>

      {/* 3. 最近的决定时间线 */}
      <section className="fancy-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-extrabold text-text" style={{ fontFamily: 'var(--font-display)' }}>最近的决定</h4>
          <button
            type="button"
            onClick={onOpenFootprint}
            className="text-xs text-primary font-bold flex items-center gap-0.5 hover:underline"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            全部 <IconChevronRight className="w-3 h-3" />
          </button>
        </div>
        {recentDecisions.length === 0 ? (
          <p className="text-xs text-text-muted">标记「去过」的餐厅会出现在这里</p>
        ) : (
          <div className="space-y-2.5">
            {recentDecisions.map(r => {
              const MoodIcon = r.mood === 'great' ? IconSmile : r.mood === 'ok' ? IconMeh : r.mood === 'bad' ? IconFrown : null;
              const cuisineEmoji = r.cuisine?.includes('火锅') ? '🍲' : r.cuisine?.includes('川') ? '🌶️' : r.cuisine?.includes('日') ? '🍣' : '🍽️';
              return (
                <div key={r.id} className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-full bg-bg-soft border-2 flex items-center justify-center text-sm flex-shrink-0" style={{ borderColor: 'var(--color-ink)' }}>
                    <EmojiToIcon emoji={cuisineEmoji} size={18} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-text truncate" style={{ fontFamily: 'var(--font-display)' }}>{r.name}</p>
                    <p className="text-xs text-text-muted">{formatTime(r.timestamp)} · {r.cuisine || '美食'}</p>
                  </div>
                  <span className="text-lg" aria-label="感受">
                    {MoodIcon ? <MoodIcon className="w-5 h-5 text-primary" /> : <EmojiToIcon emoji="🍽️" size={20} />}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 4. 成就徽章 */}
      <section className="fancy-card p-5">
        <h4 className="text-sm font-extrabold text-text mb-3" style={{ fontFamily: 'var(--font-display)' }}>成就徽章</h4>
        <div className="grid grid-cols-4 gap-3">
          {badges.map(badge => (
            <div
              key={badge.id}
              className={`text-center p-2 rounded-xl border-2 transition-all ${badge.unlocked ? 'bg-white' : 'bg-bg-soft opacity-50'}`}
              style={{ borderColor: 'var(--color-ink)' }}
              title={badge.desc}
            >
              <div className="flex justify-center mb-1">
                {badge.id === 'decade' && <IconTarget className="w-7 h-7 text-primary" />}
                {badge.id === 'spicy' && <IconChili className="w-7 h-7" />}
                {badge.id === 'organizer' && <IconUsers className="w-7 h-7 text-secondary" />}
                {badge.id === 'solo' && <IconSolo className="w-7 h-7 text-primary" />}
              </div>
              <p className="text-[10px] font-extrabold text-text leading-tight" style={{ fontFamily: 'var(--font-display)' }}>{badge.label}</p>
              <p className={`text-[9px] mt-0.5 leading-tight ${badge.unlocked ? 'text-secondary font-bold' : 'text-text-muted'}`}>
                {badge.unlocked ? '已解锁' : '未解锁'}
              </p>
            </div>
          ))}
          {/* 预留占位徽章 */}
          <div className="text-center p-2 rounded-xl border-2 border-dashed bg-bg-soft/50 opacity-40" style={{ borderColor: 'var(--color-ink)' }}>
            <div className="flex justify-center mb-1">
              <IconTrophy className="w-7 h-7 text-text-muted" />
            </div>
            <p className="text-[10px] font-extrabold text-text leading-tight" style={{ fontFamily: 'var(--font-display)' }}>敬请期待</p>
          </div>
        </div>
      </section>

      {/* 5. 设置项 */}
      <section className="fancy-card p-2">
        <button type="button" className="w-full flex items-center justify-between px-4 py-3 text-sm text-text hover:bg-bg-soft rounded-xl transition-colors" style={{ fontFamily: 'var(--font-display)' }}>
          <span className="flex items-center gap-2"><IconComment className="w-4 h-4" /> 联系我们</span>
          <IconChevronRight className="w-4 h-4 text-text-muted" />
        </button>
        <button
          type="button"
          onClick={handleClearData}
          className="w-full flex items-center justify-between px-4 py-3 text-sm text-error hover:bg-bg-soft rounded-xl transition-colors"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          <span className="flex items-center gap-2"><IconTrash2 className="w-4 h-4" /> 清除本地数据</span>
          <IconChevronRight className="w-4 h-4 text-error/60" />
        </button>
        <button type="button" className="w-full flex items-center justify-between px-4 py-3 text-sm text-text hover:bg-bg-soft rounded-xl transition-colors" style={{ fontFamily: 'var(--font-display)' }}>
          <span className="flex items-center gap-2"><IconInfo className="w-4 h-4" /> 关于吃什么</span>
          <IconChevronRight className="w-4 h-4 text-text-muted" />
        </button>
      </section>
    </div>
  );
}

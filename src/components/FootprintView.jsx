import { useState, useEffect } from 'react';
import {
  IconBookmark, IconCheckCircle, IconHistory,
  IconStar, IconMapPin, IconTrash, IconSparkles,
  IconSmile, IconMeh, IconFrown
} from './icons/FancyIcons';
import { getFavorites, getVisited, getSearchHistory, clearSearchHistory, setVisitedMood } from '../services/historyService';
import { getSoloModes } from '../services/recommendationService';

const MOOD_OPTIONS = [
  { key: 'great', icon: IconSmile, label: '好吃' },
  { key: 'ok', icon: IconMeh, label: '还行' },
  { key: 'bad', icon: IconFrown, label: '一般' },
];

export default function FootprintView({ onReselect }) {
  const [activeTab, setActiveTab] = useState('favorites');
  const [favorites, setFavorites] = useState([]);
  const [visited, setVisited] = useState([]);
  const [history, setHistory] = useState([]);

  const refreshData = () => {
    setFavorites(getFavorites());
    setVisited(getVisited());
    setHistory(getSearchHistory());
  };

  useEffect(() => { refreshData(); }, []);

  const handleClearHistory = () => {
    clearSearchHistory();
    refreshData();
  };

  const handleMoodClick = (id, mood) => {
    setVisitedMood(id, mood);
    refreshData();
  };

  const formatTime = (ts) => {
    const d = new Date(ts);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    const days = Math.floor(diff / 86400000);
    if (days < 7) return `${days}天前`;
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  };

  const getModeLabel = (mode) => {
    const modes = getSoloModes();
    return modes[mode]?.label || mode || '';
  };

  const tabs = [
    { id: 'favorites', label: '收藏', icon: IconBookmark, count: favorites.length },
    { id: 'visited', label: '去过', icon: IconCheckCircle, count: visited.length },
    { id: 'history', label: '搜索历史', icon: IconHistory, count: history.length },
  ];

  return (
    <div className="max-w-lg mx-auto px-6">
      {/* Tab 切换 */}
      <div className="flex gap-2 mb-6 fade-in">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                activeTab === tab.id
                  ? 'bg-brand-700 text-white border-2 shadow-[2px_2px_0_var(--color-ink)]'
                  : 'bg-white text-text-secondary border-2 hover:bg-bg-soft'
              }`}
              style={{ borderColor: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span className={`text-xs px-1.5 rounded-full font-medium ${activeTab === tab.id ? 'bg-white/40 text-text' : 'bg-bg-soft text-text-secondary'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 收藏列表 */}
      {activeTab === 'favorites' && (
        <div className="space-y-3">
          {favorites.length === 0 ? (
            <EmptyState icon="bookmark" text="还没有收藏的餐厅" subtext="点击餐厅卡片上的「收藏」按钮来保存" />
          ) : (
            favorites.map((r, i) => (
              <RestaurantMiniCard key={r.id} restaurant={r} index={i} formatTime={formatTime} />
            ))
          )}
        </div>
      )}

      {/* 去过列表（可切换感受表情） */}
      {activeTab === 'visited' && (
        <div className="space-y-3">
          {visited.length === 0 ? (
            <EmptyState icon="check" text="还没有标记去过的餐厅" subtext="点击餐厅卡片上的「标记去过」按钮来记录" />
          ) : (
            visited.map((r, i) => (
              <VisitedCard
                key={r.id}
                restaurant={r}
                index={i}
                formatTime={formatTime}
                onMoodClick={handleMoodClick}
              />
            ))
          )}
        </div>
      )}

      {/* 搜索历史 */}
      {activeTab === 'history' && (
        <div className="space-y-3">
          {history.length === 0 ? (
            <EmptyState icon="history" text="还没有搜索记录" subtext="搜索过的内容会出现在这里" />
          ) : (
            <>
              {history.length > 0 && (
                <div className="flex justify-end mb-1">
                  <button onClick={handleClearHistory} className="text-text-muted text-xs font-medium flex items-center gap-1 hover:text-error transition-colors">
                    <IconTrash className="w-3.5 h-3.5" /> 清空
                  </button>
                </div>
              )}
              {history.map((h, i) => (
                <button
                  key={h.id}
                  onClick={() => onReselect && onReselect(h)}
                  className="w-full flat-card p-3.5 text-left flex items-center gap-3 hover:bg-bg-secondary transition-colors animate-slide-up"
                  style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'both' }}
                >
                  <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                    <IconHistory className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text font-medium truncate">{h.text || '未输入文字'}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {h.mode && <span className="text-xs text-text-muted">{getModeLabel(h.mode)}</span>}
                      <span className="text-xs text-text-muted">· {formatTime(h.timestamp)}</span>
                    </div>
                  </div>
                  <IconSparkles className="w-4 h-4 text-text-muted flex-shrink-0" />
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function RestaurantMiniCard({ restaurant, index, formatTime }) {
  const photo = restaurant.photos?.[0]?.url;
  return (
    <div
      className="flat-card p-3.5 flex items-center gap-3 animate-slide-up"
      style={{ animationDelay: `${index * 60}ms`, animationFillMode: 'both' }}
    >
      {photo ? (
        <img src={photo} alt={restaurant.name} className="w-14 h-14 rounded-xl object-cover border-2 flex-shrink-0" style={{ borderColor: 'var(--color-ink)' }} loading="lazy" />
      ) : (
        <div className="w-14 h-14 rounded-xl bg-bg-soft border-2 flex items-center justify-center flex-shrink-0" style={{ borderColor: 'var(--color-ink)' }}>
          <IconMapPin className="w-5 h-5 text-text-muted" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <h4 className="font-bold text-text text-sm truncate" style={{ fontFamily: 'var(--font-display)' }}>{restaurant.name}</h4>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-text-muted">
          {restaurant.cuisine && <span>{restaurant.cuisine}</span>}
          {restaurant.price > 0 && <span>· 人均{restaurant.price}元</span>}
        </div>
        <div className="flex items-center gap-2 mt-1">
          {restaurant.rating > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-accent-dark font-medium">
              <IconStar className="w-3 h-3" filled /> {restaurant.rating}
            </span>
          )}
          <span className="text-xs text-text-muted">{formatTime(restaurant.timestamp)}</span>
        </div>
      </div>
    </div>
  );
}

/** 去过卡片：RestaurantMiniCard + 感受表情切换 */
function VisitedCard({ restaurant, index, formatTime, onMoodClick }) {
  return (
    <div className="animate-slide-up" style={{ animationDelay: `${index * 60}ms`, animationFillMode: 'both' }}>
      <RestaurantMiniCard restaurant={restaurant} index={index} formatTime={formatTime} />
      <div className="flex items-center gap-1.5 px-3.5 -mt-1 pb-1">
        <span className="text-xs text-text-muted font-bold" style={{ fontFamily: 'var(--font-display)' }}>感受：</span>
        {MOOD_OPTIONS.map(opt => {
          const active = restaurant.mood === opt.key;
          const Icon = opt.icon;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => onMoodClick(restaurant.id, opt.key)}
              title={opt.label}
              aria-label={`标记${opt.label}`}
              className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-base transition-all hover:scale-110 ${
                active ? 'bg-bg-secondary shadow-[2px_2px_0_var(--color-ink)]' : 'bg-white opacity-60 hover:opacity-100'
              }`}
              style={{ borderColor: 'var(--color-ink)' }}
            >
              <Icon className="w-4 h-4" />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function EmptyState({ icon, text, subtext }) {
  const Icon = icon === 'bookmark' ? IconBookmark : icon === 'check' ? IconCheckCircle : IconHistory;
  return (
    <div className="text-center py-16 fade-in">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-bg-soft mb-4">
        <Icon className="w-7 h-7 text-text-muted" />
      </div>
      <p className="text-text font-bold text-sm mb-1">{text}</p>
      <p className="text-text-muted text-xs">{subtext}</p>
    </div>
  );
}

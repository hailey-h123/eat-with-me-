import { useState, useEffect } from 'react';
import {
  IconBookmark, IconCheckCircle, IconHistory, IconArrowLeft,
  IconStar, IconMapPin, IconTrash, IconSparkles
} from './icons/FancyIcons';
import { getFavorites, getVisited, getSearchHistory, clearSearchHistory } from '../services/historyService';

export default function HistoryView({ onBack, onReselect }) {
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
    const labels = {
      tired: '疲惫模式', happy: '开心模式', fresh: '想尝鲜',
      explore_near: '1km探索', explore_mid: '3km探索',
      explore_far: '5km探索', explore_any: '全城探索', fortune: '美食占卜',
    };
    return labels[mode] || mode || '';
  };

  const tabs = [
    { id: 'favorites', label: '收藏', icon: IconBookmark, count: favorites.length },
    { id: 'visited', label: '去过', icon: IconCheckCircle, count: visited.length },
    { id: 'history', label: '搜索历史', icon: IconHistory, count: history.length },
  ];

  return (
    <div className="max-w-lg mx-auto px-6">
      <div className="flex items-center justify-between mb-5 fade-in">
        <button onClick={onBack} className="text-primary text-sm font-medium flex items-center gap-1">
          <IconArrowLeft className="w-4 h-4" /> 返回
        </button>
        {activeTab === 'history' && history.length > 0 && (
          <button onClick={handleClearHistory} className="text-text-muted text-xs font-medium flex items-center gap-1 hover:text-error transition-colors">
            <IconTrash className="w-3.5 h-3.5" /> 清空
          </button>
        )}
      </div>

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
              style={activeTab === tab.id ? { borderColor: 'var(--color-ink)', fontFamily: 'var(--font-display)' } : { borderColor: 'var(--color-ink)', fontFamily: 'var(--font-display)' }}
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

      {/* 去过列表 */}
      {activeTab === 'visited' && (
        <div className="space-y-3">
          {visited.length === 0 ? (
            <EmptyState icon="check" text="还没有标记去过的餐厅" subtext="点击餐厅卡片上的「标记去过」按钮来记录" />
          ) : (
            visited.map((r, i) => (
              <RestaurantMiniCard key={r.id} restaurant={r} index={i} formatTime={formatTime} />
            ))
          )}
        </div>
      )}

      {/* 搜索历史 */}
      {activeTab === 'history' && (
        <div className="space-y-2">
          {history.length === 0 ? (
            <EmptyState icon="history" text="还没有搜索记录" subtext="搜索过的内容会出现在这里" />
          ) : (
            history.map((h, i) => (
              <button
                key={h.id}
                onClick={() => onReselect && onReselect(h)}
                className="w-full fancy-card p-3.5 text-left flex items-center gap-3 hover:bg-bg-secondary transition-colors animate-slide-up"
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
            ))
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
      className="fancy-card p-3.5 flex items-center gap-3 animate-slide-up"
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

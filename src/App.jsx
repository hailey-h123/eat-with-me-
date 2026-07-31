import { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import LocationBar from './components/LocationBar';
import HomeView from './components/HomeView';
import SoloInput from './components/SoloInput';
import GroupInput from './components/GroupInput';
import ResultList from './components/ResultList';
import VoteView from './components/VoteView';
import HistoryView from './components/HistoryView';
import { useLocation } from './hooks/useLocation';
import { parseMemberIntent, mergeMemberIntents, parseIntent } from './services/llmService';
import { recommendRestaurants, randomExplore, recommendByMode, drawFortuneCard, analyzeEmptyResult } from './services/recommendationService';
import { geocode, IS_MOCK_MODE } from './services/amapService';
import { calculateSingleScore, calculateSoloFriendly, setScoringTranslator } from './services/scoringService';
import { addSearchHistory } from './services/historyService';
import {
  trackPageView, trackSearch,
  trackResultsShown, trackReroll, trackFeedback
} from './services/analyticsService';
import { useTranslation } from './i18n';

const LAST_MODE_KEY = 'eatwithme_last_mode';

function App() {
  const { t } = useTranslation();
  const { location, isLocating, error, debugInfo, retryLocate, updateLocation } = useLocation();
  const [currentView, setCurrentView] = useState('home');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastIntent, setLastIntent] = useState(null);
  const [isExploreMode, setIsExploreMode] = useState(false);
  const [lastMembers, setLastMembers] = useState([]);
  const [lastSoloMode, setLastSoloMode] = useState('tired');
  const [lastSoloText, setLastSoloText] = useState('');
  const [lastExploreMode, setLastExploreMode] = useState('fresh');
  const [lastExploreMembers, setLastExploreMembers] = useState([]);
  const [emptySuggestions, setEmptySuggestions] = useState([]);
  const [searchRadius, setSearchRadius] = useState(3000);
  const rerollCountRef = useRef(0);
  const searchRef = useRef(false);

  useEffect(() => {
    try {
      const lastMode = localStorage.getItem(LAST_MODE_KEY);
      if (lastMode === 'solo') setCurrentView('solo-input');
      else if (lastMode === 'group') setCurrentView('group-input');
    } catch {}
  }, []);

  // 将 i18n 翻译函数注入评分服务，直接注入确保最新语言
  setScoringTranslator(t);

  // 页面浏览埋点：currentView 变化时上报
  useEffect(() => {
    const pageNames = {
      home: '首页',
      'solo-input': '一人食入口',
      'group-input': '多人聚餐入口',
      'solo-results': '单人推荐结果',
      'group-results': '多人推荐结果',
      vote: '投票页',
      history: '我的收藏',
    };
    trackPageView(pageNames[currentView] || currentView);
  }, [currentView]);

  const handleLocationChange = async (newLocation) => {
    const isDefaultCoords = newLocation.lat === 39.9997 && newLocation.lng === 116.4706;
    const needGeocode = !newLocation.lat || !newLocation.lng || isDefaultCoords;
    if (newLocation.name && needGeocode) {
      const geoResult = await geocode(newLocation.name);
      if (geoResult) {
        updateLocation({ name: newLocation.name, lat: geoResult.lat, lng: geoResult.lng });
        return { success: true };
      }
      if (location.lat && location.lng) {
        updateLocation({ name: newLocation.name, lat: location.lat, lng: location.lng });
        return { success: true, fallback: 'coordinates' };
      }
      throw new Error('无法获取该位置的坐标，请尝试更详细的地址描述');
    }
    updateLocation(newLocation);
    return { success: true };
  };

  const handleSelectSolo = () => { try { localStorage.setItem(LAST_MODE_KEY, 'solo'); } catch {} setCurrentView('solo-input'); };
  const handleSelectGroup = () => { try { localStorage.setItem(LAST_MODE_KEY, 'group'); } catch {} setCurrentView('group-input'); };

  const handleSearch = async (members) => {
    setIsLoading(true);
    setLastMembers(members);
    try {
    const debugInfo = [];
    debugInfo.push(`raw: ${members.map(m => `${m.name}=${m.text}`).join(', ')}`);
    const memberIntents = members.map(m => {
      const intent = parseMemberIntent(m.text, m.name);
      debugInfo.push(`parsed ${m.name}: prefs=[${intent.preferences.join(',')}]`);
      return intent;
    });
    const groupIntent = mergeMemberIntents(memberIntents);
    debugInfo.push(`merged: members=${groupIntent.members.length}, prefs=[${groupIntent.preferences.join(',')}]`);
    console.log('[BUGFIX]', debugInfo.join(' | '));
    if (!groupIntent.location && location.name) groupIntent.location = location.name;
    setLastIntent(groupIntent);
    setSearchRadius(3000);
    const recommendations = await recommendRestaurants(groupIntent, location);
    setResults(recommendations);
    if (recommendations.length === 0) {
      setEmptySuggestions(analyzeEmptyResult(groupIntent, 3000));
    } else {
      setEmptySuggestions([]);
    }
    addSearchHistory({ text: members.map(m => m.text).join(' + '), mode: 'group' });
    setIsExploreMode(false);
    trackSearch('group', { memberCount: members.length });
    trackResultsShown(recommendations.length, 'group', recommendations.length === 0);
    setCurrentView(members.length === 1 ? 'solo-results' : 'group-results');
    } catch (e) {
      console.error('[handleSearch] error:', e);
      setCurrentView('group-results');
    } finally {
      setIsLoading(false);
    }
  };

  const [lastSoloPrefs, setLastSoloPrefs] = useState(null);

  const handleSoloSearch = async (mode, text, prefs = null, excludeIds = []) => {
    if (searchRef.current) return;
    searchRef.current = true;
    try {
      setIsLoading(true);
      setLastSoloMode(mode);
      setLastSoloText(text);
      setLastSoloPrefs(prefs);
      setIsExploreMode(['explore_near', 'explore_mid', 'explore_far', 'explore_any', 'fortune'].includes(mode));
      let extraIntent = null;
      let currentRadius = 3000;
      if (prefs && (prefs.priceRange || prefs.distRange || (prefs.preferences && prefs.preferences.length > 0))) {
        extraIntent = {
          preferences: prefs.preferences || [],
          allergies: [],
          priceRange: prefs.priceRange,
          distRange: prefs.distRange,
        };
        if (prefs.distRange) {
          if (prefs.distRange === 'near') currentRadius = 1000;
          else if (prefs.distRange === 'mid') currentRadius = 3000;
          else if (prefs.distRange === 'far') currentRadius = 5000;
          else if (prefs.distRange === 'any') currentRadius = 8000;
        }
      } else if (text && text.trim()) {
        const parsed = parseIntent(text.trim());
        extraIntent = { preferences: parsed.preferences || [], allergies: parsed.allergies || [], budget: parsed.budget };
      }
      setSearchRadius(currentRadius);
      const recommendations = await recommendByMode(mode, location, extraIntent, null, null, excludeIds);
      setResults(recommendations);
      if (recommendations.length === 0 && extraIntent) {
        setEmptySuggestions(analyzeEmptyResult(extraIntent, currentRadius));
      } else {
        setEmptySuggestions([]);
      }
      setLastIntent({ mode, text, solo: true, prefs, extraIntent });
      if (text && text.trim()) addSearchHistory({ text: text.trim(), mode });
      setCurrentView('solo-results');
      trackSearch('solo', { searchText: text || '', hasPrefFilter: !!prefs });
      trackResultsShown(recommendations.length, mode, recommendations.length === 0);
    } finally { 
      setIsLoading(false); 
      searchRef.current = false;
    }
  };

  const handleSoloFortune = async (fortuneCard) => {
    if (searchRef.current) return;
    searchRef.current = true;
    try {
      setIsLoading(true); setIsExploreMode(true); setLastSoloMode('fortune');
      const extraIntent = lastSoloText ? parseIntent(lastSoloText) : null;
      const recommendations = await recommendByMode('fortune', location, extraIntent ? { preferences: extraIntent.preferences || [], allergies: extraIntent.allergies || [], budget: extraIntent.budget } : null, fortuneCard);
      setResults(recommendations);
      setLastIntent({ mode: 'fortune', text: lastSoloText, solo: true, fortuneCard });
      setCurrentView('solo-results');
    } finally { 
      setIsLoading(false); 
      searchRef.current = false;
    }
  };

  const handleGroupSearch = (members) => handleSearch(members);
  const handleVote = () => {
    try { localStorage.removeItem('eatwithme_vote_session'); } catch {}
    setCurrentView('vote');
  };
  const handleVoteSelect = (restaurant) => { setResults([restaurant]); setCurrentView('group-results'); };

  const handleRandomExplore = async (mode = 'fresh', members = [], excludeIds = []) => {
    setIsLoading(true); setLastExploreMode(mode); setLastExploreMembers(members); setLastMembers(members);
    const restaurant = await randomExplore(location, mode, members, excludeIds);
    setResults([restaurant]); setIsExploreMode(true); setIsLoading(false);
    setCurrentView(currentView === 'solo-input' ? 'solo-results' : 'group-results');
  };

  const handleSoloExplore = (mode) => handleRandomExplore(mode, []);
  const handleGroupExplore = (mode, members) => handleRandomExplore(mode, members);

  const handleRefresh = async () => {
    rerollCountRef.current += 1;
    // 收集当前已展示的餐厅ID，换一批时排除
    const currentIds = results.map(r => r.id).filter(Boolean);
    if (isExploreMode) {
      if (lastIntent?.solo) {
        if (lastSoloMode === 'fortune') {
          setIsLoading(true); setIsExploreMode(true);
          try {
            const card = lastIntent.fortuneCard || drawFortuneCard();
            const currentId = results[0]?.id;
            const recommendations = await recommendByMode('fortune', location, null, card, currentId, currentIds);
            setResults(recommendations);
          } finally { setIsLoading(false); }
        } else {
          await handleSoloSearch(lastSoloMode, lastSoloText, lastSoloPrefs, currentIds);
        }
      } else {
        await handleRandomExplore(lastExploreMode, lastExploreMembers, currentIds);
      }
    } else if (lastIntent) {
      if (lastIntent.solo) await handleSoloSearch(lastSoloMode, lastSoloText, lastSoloPrefs, currentIds);
      else { setIsLoading(true); const r = await recommendRestaurants(lastIntent, location, currentIds); setResults(r); setIsLoading(false); }
    }
    trackReroll(isExploreMode ? (lastSoloMode || lastExploreMode || 'explore') : 'group', rerollCountRef.current);
  };

  const handleBack = () => {
    if (currentView === 'solo-results') setCurrentView('solo-input');
    else if (currentView === 'group-results') setCurrentView('group-input');
    setResults([]); setLastIntent(null); setEmptySuggestions([]);
  };
  const handleBackToHome = () => { setCurrentView('home'); setResults([]); setLastIntent(null); setEmptySuggestions([]); };

  const handleFeedback = (type, restaurant) => {
    trackFeedback(type, {
      cuisine: restaurant.cuisine || '',
      price: restaurant.price || 0,
      rating: restaurant.rating || 0,
    });
  };

  const handleHistoryReselect = (historyItem) => {
    // 根据历史记录的模式跳转到相应页面
    if (historyItem.mode === 'group') {
      // 多人模式：跳转到多人入口，历史文本无法直接恢复（因为多人模式是多个成员输入）
      // 可以考虑解析 text（格式为"成员1输入 + 成员2输入"）但比较复杂
      // 暂时只跳转并提示
      setCurrentView('group-input');
    } else {
      // 单人模式：跳转到单人入口并填充历史文本
      setLastSoloMode(historyItem.mode);
      setLastSoloText(historyItem.text || '');
      setCurrentView('solo-input');
    }
  };

  const handleApplySuggestion = async (suggestion) => {
    if (!lastIntent) return;
    setIsLoading(true);
    setEmptySuggestions([]);

    if (lastIntent.solo) {
      const currentExtra = lastIntent.extraIntent || { preferences: [], allergies: [], budget: null };
      let newExtra = { ...currentExtra };
      let newRadius = searchRadius;

      switch (suggestion.action.type) {
        case 'replace_cuisine':
          newExtra.preferences = (newExtra.preferences || []).filter(p => p !== suggestion.action.from);
          newExtra.preferences.push(suggestion.action.to);
          break;
        case 'expand_radius':
          newRadius = suggestion.action.radius;
          break;
        case 'set_budget':
          newExtra.budget = suggestion.action.budget;
          break;
        case 'remove_allergy':
          newExtra.allergies = (newExtra.allergies || []).filter(a => a !== suggestion.action.allergy);
          break;
        case 'clear_preferences':
          newExtra = { preferences: [], allergies: [], budget: null };
          newRadius = 5000;
          break;
      }

      const newPrefs = lastSoloPrefs ? { ...lastSoloPrefs } : null;
      if (newPrefs && newPrefs.preferences && suggestion.action.type === 'replace_cuisine') {
        newPrefs.preferences = (newPrefs.preferences || []).filter(p => p !== suggestion.action.from);
        newPrefs.preferences.push(suggestion.action.to);
      }

      setSearchRadius(newRadius);
      const recommendations = await recommendByMode(lastSoloMode, location, newExtra, null, null, []);
      setResults(recommendations);
      setLastIntent({ ...lastIntent, extraIntent: newExtra });
      setLastSoloPrefs(newPrefs);
      if (recommendations.length === 0) {
        setEmptySuggestions(analyzeEmptyResult(newExtra, newRadius));
      }
    } else {
      let newIntent = { ...lastIntent };

      switch (suggestion.action.type) {
        case 'replace_cuisine':
          newIntent.preferences = (newIntent.preferences || []).filter(p => p !== suggestion.action.from);
          newIntent.preferences.push(suggestion.action.to);
          break;
        case 'expand_radius':
          setSearchRadius(suggestion.action.radius);
          break;
        case 'set_budget':
          newIntent.budget = suggestion.action.budget;
          break;
        case 'remove_allergy':
          newIntent.allergies = (newIntent.allergies || []).filter(a => a !== suggestion.action.allergy);
          break;
        case 'clear_preferences':
          newIntent.preferences = [];
          newIntent.allergies = [];
          newIntent.budget = null;
          setSearchRadius(5000);
          break;
      }

      const recommendations = await recommendRestaurants(newIntent, location);
      setResults(recommendations);
      setLastIntent(newIntent);
      if (recommendations.length === 0) {
        setEmptySuggestions(analyzeEmptyResult(newIntent, searchRadius));
      }
    }

    setIsLoading(false);
  };

  const getHeaderConfig = () => {
    switch (currentView) {
      case 'home': return { title: t('app.title'), subtitle: t('app.subtitle'), showBack: false };
      case 'solo-input': return { title: t('header.solo'), subtitle: t('header.soloSub'), showBack: true, onBack: handleBackToHome };
      case 'group-input': return { title: t('header.group'), subtitle: t('header.groupSub'), showBack: true, onBack: handleBackToHome };
      case 'solo-results': case 'group-results': return { title: t('header.recommendResult'), subtitle: '', showBack: true, onBack: handleBack };
      case 'vote': return { title: t('header.vote'), subtitle: '', showBack: true, onBack: () => setCurrentView('group-results') };
      case 'history': return { title: t('header.favorites'), subtitle: '', showBack: true, onBack: handleBackToHome };
      default: return { title: t('app.title'), subtitle: t('app.subtitle'), showBack: false };
    }
  };

  const showVote = currentView === 'group-results' && !isExploreMode;
  const headerConfig = getHeaderConfig();

  return (
    <div className="min-h-screen">
      <Header title={headerConfig.title} subtitle={headerConfig.subtitle} showBack={headerConfig.showBack} onBack={headerConfig.onBack} />
      {IS_MOCK_MODE && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-center">
          <p className="text-sm text-amber-800">
            🎯 <strong>{t('demo.badge')}</strong> · {t('demo.hint')}
            <span className="ml-2 text-amber-600">
              （
              <button
                onClick={() => alert('1. 访问 https://console.amap.com/dev/key/app\n2. 创建「Web端(JS API)」应用\n3. 创建「Web服务」应用\n4. 复制 .env.example 为 .env 并填入 Key')}
                className="underline hover:text-amber-900"
              >
                {t('demo.howTo')}
              </button>
              ）
            </span>
          </p>
        </div>
      )}
      <LocationBar location={location} isLocating={isLocating} error={error} debugInfo={debugInfo} onLocationChange={handleLocationChange} onRetry={retryLocate} />
      {currentView === 'home' && <main className="py-8"><HomeView onSelectSolo={handleSelectSolo} onSelectGroup={handleSelectGroup} onOpenHistory={() => setCurrentView('history')} location={location} onQuickPick={(restaurant) => {
        const { score, reasons } = calculateSingleScore(restaurant, { preferences: [], allergies: [] });
        const scoredRestaurant = {
          ...restaurant,
          matchScore: score,
          reasons,
          soloFriendly: calculateSoloFriendly(restaurant),
        };
        setResults([scoredRestaurant]);
        setIsExploreMode(false);
        setSearchRadius(3000);
        setCurrentView('solo-results');
      }} /></main>}
      {currentView === 'solo-input' && <main className="py-8"><SoloInput onSearch={handleSoloSearch} onFortune={handleSoloFortune} isLoading={isLoading} /></main>}
      {currentView === 'group-input' && <main className="py-8"><GroupInput onSearch={handleGroupSearch} onRandomExplore={handleGroupExplore} isLoading={isLoading} /></main>}
      {(currentView === 'solo-results' || currentView === 'group-results') && <main className="py-8"><ResultList results={results} onBack={handleBack} onRefresh={handleRefresh} isLoading={isLoading} isExploreMode={isExploreMode} isSolo={currentView === 'solo-results'} location={location} onVote={handleVote} showVote={showVote} cuisineVote={lastIntent?.cuisineVote} memberCount={lastMembers.length} conflicts={lastIntent?.conflicts} emptySuggestions={emptySuggestions} onApplySuggestion={handleApplySuggestion} onFeedback={handleFeedback} /></main>}
      {currentView === 'vote' && <main className="py-8"><VoteView restaurants={results} members={lastMembers} onBack={() => setCurrentView('group-results')} onSelect={handleVoteSelect} /></main>}
      {currentView === 'history' && <main className="py-8"><HistoryView onBack={handleBackToHome} onReselect={handleHistoryReselect} /></main>}
      <footer className="text-center py-10 mt-auto">
        <p className="text-xs text-ink-tertiary">{t('app.footer')}</p>
      </footer>
    </div>
  );
}

export default App;
import React, { useState, useEffect, useRef } from 'react';
import Header from './components/Header';
import LocationBar from './components/LocationBar';
import TabBar from './components/TabBar';
import HomeView from './components/HomeView';
import SoloInput from './components/SoloInput';
import GroupInput from './components/GroupInput';
import ResultList from './components/ResultList';
import VoteView from './components/VoteView';
import FootprintView from './components/FootprintView';
import ProfileView from './components/ProfileView';
import FortuneDrawView from './components/FortuneDrawView';
import Mascot from './components/Mascot';
import { IconTarget } from './components/icons/FancyIcons';
import { useLocation } from './hooks/useLocation';
import { addLike, addDislike, removeLike, removeDislike, makeProfileFingerprint } from './services/feedbackService';
import { parseIntent, mergeMemberIntentsWithLLM, parseSoloIntentWithLLM } from './services/llmService';
import { recommendRestaurants, randomExplore, recommendByMode, drawFortuneCard, analyzeEmptyResult, getSearchRadiusFromIntent } from './services/recommendationService';
import { geocode, IS_MOCK_MODE } from './services/amapService';
import { calculateSingleScore, calculateSoloFriendly } from './services/scoringService';
import { addSearchHistory, incrementDecisionCount } from './services/historyService';
import {
  trackPageView, trackSearch,
  trackResultsShown, trackReroll, trackFeedback
} from './services/analyticsService';

const LAST_MODE_KEY = 'eatwithme_last_mode';
const CURRENT_VIEW_KEY = 'eatwithme_current_view';

// ErrorBoundary: 捕获新 Tab 页面的渲染错误，显示调试信息而不是白屏
class TabErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('[TabErrorBoundary] 捕获到渲染错误:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="max-w-lg mx-auto px-6 py-16 text-center">
          <div className="flex justify-center mb-4">
            <Mascot mood="surprise" size={80} />
          </div>
          <h3 className="font-bold text-text mb-2">页面加载出错了</h3>
          <p className="text-text-muted text-sm mb-4">{this.state.error?.message}</p>
          <pre className="text-xs text-left bg-bg-soft p-3 rounded-lg overflow-auto max-h-40 text-text-muted">
            {this.state.error?.stack?.split('\n').slice(0, 5).join('\n')}
          </pre>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-4 px-4 py-2 bg-brand-700 text-white rounded-xl font-bold text-sm"
          >
            重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
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
  const [fortuneFromHome, setFortuneFromHome] = useState(false);
  const rerollCountRef = useRef(0);
  const searchRef = useRef(false);
  /** 刷新期间禁止切换 view，保证"在哪个页面刷新还显示哪个页面" */
  const isRefreshRef = useRef(false);
  /** 累积本会话所有展示过的餐厅ID，"再来一个"时全部排除，避免循环重复 */
  const seenRestaurantIdsRef = useRef([]);

  useEffect(() => {
    try {
      // 优先恢复上次保存的 view，而不是只根据 LAST_MODE_KEY 跳到输入页
      const savedView = localStorage.getItem(CURRENT_VIEW_KEY);
      if (savedView === 'solo-results' || savedView === 'solo-input') {
        setCurrentView('solo-input');
      } else if (savedView === 'group-results' || savedView === 'group-input') {
        setCurrentView('group-input');
      } else if (savedView === 'home') {
        // 首页刷新：留在首页
      } else if (savedView === 'footprint' || savedView === 'profile') {
        // 足迹/我的：本地数据，可完整恢复
        setCurrentView(savedView);
      } else if (savedView === 'vote') {
        // 投票页依赖内存 results/lastMembers，无法恢复 → 回首页
      } else {
        // 首次访问（无任何 view 记录）：回退到上次模式
        const lastMode = localStorage.getItem(LAST_MODE_KEY);
        if (lastMode === 'solo') setCurrentView('solo-input');
        else if (lastMode === 'group') setCurrentView('group-input');
      }
    } catch {}
  }, []);

  // view 变化时持久化，浏览器刷新后能恢复到正确的页面
  useEffect(() => {
    try { localStorage.setItem(CURRENT_VIEW_KEY, currentView); } catch {}
  }, [currentView]);

  // 页面浏览埋点：currentView 变化时上报
  useEffect(() => {
    const pageNames = {
      home: '首页',
      'solo-input': '一人食入口',
      'group-input': '多人聚餐入口',
      'solo-results': '单人推荐结果',
      'group-results': '多人推荐结果',
      vote: '投票页',
      footprint: '足迹',
      profile: '我的',
    };
    trackPageView(pageNames[currentView] || currentView);
  }, [currentView]);

  // TabBar 显示规则：主 Tab + 输入页显示；结果页/投票页沉浸隐藏
  const showTabBar = ['home', 'footprint', 'profile', 'solo-input', 'group-input'].includes(currentView);

  // Tab 切换：只切 view，不清理输入态（lastSoloText/lastMembers 等 state 保留）
  const handleTabChange = (tab) => {
    if (tab !== currentView) setCurrentView(tab);
  };

  const handleLocationChange = async (newLocation) => {
    const isDefaultCoords = newLocation.lat === 39.9997 && newLocation.lng === 116.4706;
    const needGeocode = !newLocation.lat || !newLocation.lng || isDefaultCoords;
    if (newLocation.name && needGeocode) {
      try {
        const geoResult = await geocode(newLocation.name);
        if (geoResult) {
          updateLocation({ name: newLocation.name, lat: geoResult.lat, lng: geoResult.lng });
          return { success: true, throttled: geoResult._throttled };
        }
      } catch (err) {
        // geocode 抛错（非10021）时，用当前坐标兜底，至少不卡死用户
        console.warn('[handleLocationChange] geocode失败，使用兜底坐标:', err.message);
      }
      // geocode 完全失败时，用当前坐标兜底，至少不卡死用户
      if (location.lat && location.lng) {
        updateLocation({ name: newLocation.name, lat: location.lat, lng: location.lng });
        return { success: true, fallback: 'coordinates' };
      }
      throw new Error('无法获取该位置的坐标，请尝试更详细的地址描述');
    }
    updateLocation(newLocation);
    return { success: true };
  };

  // 首页4宫格直达：按心情选 / 探索附近 —— 带 initialCategory 进 SoloInput，跳过3分类选择页
  const [soloInitialCategory, setSoloInitialCategory] = useState(null);
  const handleSelectSolo = () => { try { localStorage.setItem(LAST_MODE_KEY, 'solo'); } catch {} setSoloInitialCategory(null); setCurrentView('solo-input'); };
  const handleSelectGroup = () => { try { localStorage.setItem(LAST_MODE_KEY, 'group'); } catch {} setCurrentView('group-input'); };
  const handleSelectMood = () => { try { localStorage.setItem(LAST_MODE_KEY, 'solo'); } catch {} setSoloInitialCategory('scenario'); setCurrentView('solo-input'); };
  const handleSelectExplore = () => { try { localStorage.setItem(LAST_MODE_KEY, 'solo'); } catch {} setSoloInitialCategory('explore'); setCurrentView('solo-input'); };

  const handleSearch = async (members) => {
    setIsLoading(true);
    setLastMembers(members);
    // 首次搜索：清空已见ID累积
    seenRestaurantIdsRef.current = [];
    try {
    // LLM 增强解析：先跑规则引擎拿到 memberIntents，再用 LLM 重新解析（仅当文本非空时）
    // 尝试 LLM 增强（不阻塞，失败自动回退）
    const groupIntent = await mergeMemberIntentsWithLLM(members);
    if (!groupIntent.location && location.name) groupIntent.location = location.name;
    setLastIntent(groupIntent);
    // 搜索半径动态化：根据成员距离偏好推导，而非硬编码 3000
    const dynamicRadius = getSearchRadiusFromIntent(groupIntent);
    setSearchRadius(dynamicRadius);
    const recommendations = await recommendRestaurants(groupIntent, location);
    setResults(recommendations);
    // 累积本次展示的ID
    if (recommendations.length > 0) {
      seenRestaurantIdsRef.current = [...new Set([...seenRestaurantIdsRef.current, ...recommendations.map(r => r.id).filter(Boolean)])];
    }
    if (recommendations.length === 0) {
      setEmptySuggestions(analyzeEmptyResult(groupIntent, dynamicRadius));
    } else {
      setEmptySuggestions([]);
    }
    addSearchHistory({
      text: members.map(m => m.text).join(' + '),
      mode: 'group',
      allergies: groupIntent.allergies || [],
      distRange: groupIntent.distRange || null,
    });
    setIsExploreMode(false);
    trackSearch('group', { memberCount: members.length });
    trackResultsShown(recommendations.length, 'group', recommendations.length === 0);
    // 决定次数：成功生成多人结果 +1
    incrementDecisionCount();
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
      // 传进来的 excludeIds 为空 → 首次搜索，清空历史累积
      const isFirstSearch = !excludeIds || excludeIds.length === 0;
      if (isFirstSearch) {
        seenRestaurantIdsRef.current = [];
      }
      // 合并：本次传入的（当前屏ID） + 历史累积ID
      const mergedExcludeIds = [...new Set([...seenRestaurantIdsRef.current, ...(excludeIds || [])])];
      let extraIntent = null;
      let currentRadius = 3000;
      if (prefs && (prefs.priceRange || prefs.distRange || (prefs.preferences && prefs.preferences.length > 0))) {
        extraIntent = {
          preferences: prefs.preferences || [],
          allergies: [],
          priceRange: prefs.priceRange,
          distRange: prefs.distRange,
        };
        if (prefs.distRange && Array.isArray(prefs.distRange)) {
          const maxKm = prefs.distRange[1];
          if (maxKm <= 0.5) currentRadius = 1000;
          else if (maxKm <= 1) currentRadius = 1000;
          else if (maxKm <= 2) currentRadius = 2000;
          else if (maxKm <= 3) currentRadius = 3000;
          else if (maxKm <= 5) currentRadius = 5000;
          else currentRadius = 8000;
        }
      } else if (text && text.trim()) {
        // LLM 增强解析：优先用 LLM，失败回退到规则引擎
        const llmParsed = await parseSoloIntentWithLLM(text.trim());
        if (llmParsed) {
          extraIntent = { preferences: llmParsed.preferences || [], allergies: llmParsed.allergies || [], budget: llmParsed.budget };
        } else {
          const parsed = parseIntent(text.trim());
          extraIntent = { preferences: parsed.preferences || [], allergies: parsed.allergies || [], budget: parsed.budget, searchKeyword: (llmParsed && llmParsed.searchKeywords) ? llmParsed.searchKeywords.join('|') : undefined };
        }
      }
      setSearchRadius(currentRadius);
      const recommendations = await recommendByMode(mode, location, extraIntent, null, null, mergedExcludeIds);
      setResults(recommendations);
      // 累积本次新展示的ID到历史池
      if (recommendations.length > 0) {
        seenRestaurantIdsRef.current = [...new Set([...seenRestaurantIdsRef.current, ...recommendations.map(r => r.id).filter(Boolean)])];
      }
      if (recommendations.length === 0) {
        const baseSuggestions = extraIntent ? analyzeEmptyResult(extraIntent, currentRadius) : [];
        // 非首次搜索且返回空 → 候选池刷完了，追加提示
        if (!isFirstSearch && seenRestaurantIdsRef.current.length > 0) {
          const exhaustedTip = `已为你展示过 ${seenRestaurantIdsRef.current.length} 家符合条件的餐厅，周边暂时没有更多了。可以试试扩大距离范围、调整口味偏好，或者换个位置重新搜索～`;
          setEmptySuggestions([exhaustedTip, ...baseSuggestions]);
        } else {
          setEmptySuggestions(baseSuggestions);
        }
      } else {
        setEmptySuggestions([]);
      }
      setLastIntent({ mode, text, solo: true, prefs, extraIntent });
      if (text && text.trim()) {
        addSearchHistory({
          text: text.trim(),
          mode,
          allergies: extraIntent?.allergies || [],
          distRange: prefs?.distRange || null,
        });
      }
      if (!isRefreshRef.current) setCurrentView('solo-results');
      trackSearch('solo', { searchText: text || '', hasPrefFilter: !!prefs });
      trackResultsShown(recommendations.length, mode, recommendations.length === 0);
      // 决定次数：成功生成单人结果（含换一批，handleRefresh 复用本函数）+1
      incrementDecisionCount();
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
      // 首次抽签：清空历史累积ID
      seenRestaurantIdsRef.current = [];
      const extraIntent = lastSoloText ? parseIntent(lastSoloText) : null;
      const mergedExcludeIds = [...seenRestaurantIdsRef.current];
      const recommendations = await recommendByMode('fortune', location, extraIntent ? { preferences: extraIntent.preferences || [], allergies: extraIntent.allergies || [], budget: extraIntent.budget } : null, fortuneCard, null, mergedExcludeIds);
      setResults(recommendations);
      if (recommendations.length > 0) {
        seenRestaurantIdsRef.current = [...new Set([...seenRestaurantIdsRef.current, ...recommendations.map(r => r.id).filter(Boolean)])];
      }
      setLastIntent({ mode: 'fortune', text: lastSoloText, solo: true, fortuneCard });
      incrementDecisionCount();
      setCurrentView('solo-results');
    } finally { 
      setIsLoading(false); 
      searchRef.current = false;
    }
  };

  const handleGroupSearch = (members) => handleSearch(members);
  const handleVote = () => {
    try { localStorage.removeItem('eatwithme_vote_session'); } catch {}
    // 决定次数：多人走到投票页生成候选 +1
    incrementDecisionCount();
    setCurrentView('vote');
  };
  const handleVoteSelect = (restaurant) => {
    // 投票选定：也累积ID，防止后续刷新时重复
    if (restaurant?.id) {
      seenRestaurantIdsRef.current = [...new Set([...seenRestaurantIdsRef.current, restaurant.id])];
    }
    setResults([restaurant]); setCurrentView('group-results');
  };

  const handleRandomExplore = async (mode = 'fresh', members = [], excludeIds = []) => {
    setIsLoading(true); setLastExploreMode(mode); setLastExploreMembers(members); setLastMembers(members);
    // 传进来的 excludeIds 为空 → 首次探索，清空累积
    const isFirstExplore = !excludeIds || excludeIds.length === 0;
    if (isFirstExplore) {
      seenRestaurantIdsRef.current = [];
    }
    const mergedExcludeIds = [...new Set([...seenRestaurantIdsRef.current, ...(excludeIds || [])])];
    const restaurant = await randomExplore(location, mode, members, mergedExcludeIds);
    if (restaurant?.id) {
      seenRestaurantIdsRef.current = [...new Set([...seenRestaurantIdsRef.current, restaurant.id])];
    }
    setResults([restaurant]); setIsExploreMode(true); setIsLoading(false);
    // 决定次数：探索成功生成结果 +1
    if (restaurant) incrementDecisionCount();
    // 只在从输入页进入时切换 view，刷新时保持当前页不变
    if (!isRefreshRef.current) {
      if (currentView === 'solo-input') setCurrentView('solo-results');
      else if (currentView === 'group-input') setCurrentView('group-results');
    }
  };

  const handleSoloExplore = (mode) => handleRandomExplore(mode, []);
  const handleGroupExplore = (mode, members) => handleRandomExplore(mode, members);

  const handleRefresh = async () => {
    rerollCountRef.current += 1;
    // 刷新期间禁止切换 view，保证"在哪个页面刷新还显示哪个页面"
    isRefreshRef.current = true;
    try {
      // 收集当前已展示的餐厅ID，换一批时排除（和历史累积合并）
      const currentIds = results.map(r => r.id).filter(Boolean);
      const mergedExcludeIds = [...new Set([...seenRestaurantIdsRef.current, ...currentIds])];
      if (isExploreMode) {
        if (lastIntent?.solo) {
          if (lastSoloMode === 'fortune') {
            setIsLoading(true); setIsExploreMode(true);
            try {
              const card = lastIntent.fortuneCard || drawFortuneCard();
              const currentId = results[0]?.id;
              const recommendations = await recommendByMode('fortune', location, null, card, currentId, mergedExcludeIds);
              setResults(recommendations);
              if (recommendations.length > 0) {
                seenRestaurantIdsRef.current = [...new Set([...seenRestaurantIdsRef.current, ...recommendations.map(r => r.id).filter(Boolean)])];
              } else if (seenRestaurantIdsRef.current.length > 0) {
                const exhaustedTip = `已抽过 ${seenRestaurantIdsRef.current.length} 家餐厅，当前运势池暂时没有更多了。可以换个口味偏好或位置重新抽～`;
                setEmptySuggestions([exhaustedTip]);
              }
            } finally { setIsLoading(false); }
          } else {
            await handleSoloSearch(lastSoloMode, lastSoloText, lastSoloPrefs, currentIds);
          }
        } else {
          await handleRandomExplore(lastExploreMode, lastExploreMembers, currentIds);
        }
      } else if (lastIntent) {
        if (lastIntent.solo) {
          await handleSoloSearch(lastSoloMode, lastSoloText, lastSoloPrefs, currentIds);
        } else {
          setIsLoading(true);
          try {
            const r = await recommendRestaurants(lastIntent, location, mergedExcludeIds);
            setResults(r);
            if (r.length > 0) {
              seenRestaurantIdsRef.current = [...new Set([...seenRestaurantIdsRef.current, ...r.map(x => x.id).filter(Boolean)])];
              setEmptySuggestions([]);
            } else if (seenRestaurantIdsRef.current.length > 0) {
              const exhaustedTip = `已为你展示过 ${seenRestaurantIdsRef.current.length} 家符合条件的餐厅，周边暂时没有更多了。可以试试扩大距离范围、调整预算或口味偏好～`;
              const baseSuggestions = analyzeEmptyResult(lastIntent, searchRadius);
              setEmptySuggestions([exhaustedTip, ...baseSuggestions]);
            } else {
              setEmptySuggestions(analyzeEmptyResult(lastIntent, searchRadius));
            }
          } finally { setIsLoading(false); }
        }
      }
      trackReroll(isExploreMode ? (lastSoloMode || lastExploreMode || 'explore') : 'group', rerollCountRef.current);
    } finally {
      isRefreshRef.current = false;
    }
  };

  const handleBack = () => {
    if (fortuneFromHome) {
      setFortuneFromHome(false);
      setCurrentView('home');
    } else if (currentView === 'solo-results') {
      setCurrentView('solo-input');
    } else if (currentView === 'group-results') {
      setCurrentView('group-input');
    }
    setResults([]); setLastIntent(null); setEmptySuggestions([]);
    // 返回入口页时清空累积，下次重新搜索相当于新会话
    seenRestaurantIdsRef.current = [];
  };
  const handleBackToHome = () => {
    setCurrentView('home'); setResults([]); setLastIntent(null); setEmptySuggestions([]);
    seenRestaurantIdsRef.current = [];
  };

  const handleFeedback = (type, restaurant) => {
    // 带当前画像指纹写入 feedbackService，避免不同场景反馈互相污染
    // 多人：lastIntent.preferences/allergies/budget；单人：lastIntent.extraIntent 下；抽签：兜底 []
    const prefsSource = lastIntent?.extraIntent || lastIntent;
    const fingerprint = makeProfileFingerprint({
      preferences: prefsSource?.preferences || [],
      allergies: prefsSource?.allergies || [],
      budget: prefsSource?.budget ?? null,
    });
    if (type === 'like') {
      removeDislike(restaurant.id);
      addLike(restaurant, fingerprint);
    } else if (type === 'dislike') {
      removeLike(restaurant.id);
      addDislike(restaurant, fingerprint);
    }
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
      case 'home': return { title: '吃什么', subtitle: 'AI 用餐决策助手', showBack: false, hidden: true };
      case 'solo-input': return { title: '一人食', subtitle: 'AI 帮你做决定', showBack: true, onBack: handleBackToHome };
      case 'group-input': return { title: '多人聚餐', subtitle: '综合所有人的需求', showBack: true, onBack: handleBackToHome };
      case 'solo-results': case 'group-results': return { title: '推荐结果', subtitle: '', showBack: true, onBack: handleBack };
      case 'vote': return { title: '投票页', subtitle: '', showBack: true, onBack: () => setCurrentView('group-results') };
      case 'footprint': return { title: '足迹', subtitle: '收藏 · 去过 · 搜索历史', showBack: false };
      case 'profile': return { title: '我的', subtitle: '等级 · 口味 · 成就', showBack: false };
      default: return { title: '吃什么', subtitle: 'AI 用餐决策助手', showBack: false };
    }
  };

  const showVote = currentView === 'group-results' && !isExploreMode;
  const headerConfig = getHeaderConfig();

  return (
    <TabErrorBoundary>
    <div className="h-[100dvh] flex flex-col overflow-hidden bg-[#FFFBF0]">
      {!headerConfig.hidden && (
        <Header title={headerConfig.title} subtitle={headerConfig.subtitle} showBack={headerConfig.showBack} onBack={headerConfig.onBack} />
      )}
      <div className="flex-shrink-0">
        <LocationBar location={location} isLocating={isLocating} error={error} debugInfo={debugInfo} onLocationChange={handleLocationChange} onRetry={retryLocate} />
      </div>
      {IS_MOCK_MODE && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-1.5 text-center flex-shrink-0">
          <p className="text-[11px] text-amber-800 flex items-center justify-center gap-1.5">
            <IconTarget className="w-3 h-3" /> <strong>演示模式</strong> · 模拟数据
            <span className="ml-1 text-amber-600">
              （
              <button
                onClick={() => alert('1. 访问 https://console.amap.com/dev/key/app\n2. 创建「Web端(JS API)」应用\n3. 创建「Web服务」应用\n4. 复制 .env.example 为 .env 并填入 Key')}
                className="underline hover:text-amber-900"
              >
                如何配置
              </button>
              ）
            </span>
          </p>
        </div>
      )}
      {currentView === 'home' && (
        <main className="flex-1 min-h-0 overflow-y-auto">
          <HomeView
            onSelectMood={handleSelectMood}
            onSelectExplore={handleSelectExplore}
            onSelectGroup={handleSelectGroup}
            onFortunePick={() => {
              setFortuneFromHome(true);
              setCurrentView('fortune-draw');
            }}
            onOpenProfile={() => setCurrentView('profile')}
            location={location}
            onQuickPick={(restaurant) => {
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
              incrementDecisionCount();
              setCurrentView('solo-results');
            }}
          />
        </main>
      )}
      {currentView === 'solo-input' && <main className="flex-1 min-h-0 overflow-y-auto py-4"><SoloInput onSearch={handleSoloSearch} onFortune={handleSoloFortune} isLoading={isLoading} initialCategory={soloInitialCategory} /></main>}
      {currentView === 'fortune-draw' && <main className="flex-1 min-h-0 overflow-y-auto py-4">
        <FortuneDrawView
          onCardDrawn={(card) => {
            setFortuneFromHome(true);
            handleSoloFortune(card);
          }}
          onBack={() => {
            setFortuneFromHome(false);
            setCurrentView('home');
          }}
        />
      </main>}
      {currentView === 'group-input' && <main className="flex-1 min-h-0 overflow-y-auto py-4"><GroupInput onSearch={handleGroupSearch} onRandomExplore={handleGroupExplore} isLoading={isLoading} /></main>}
      {(currentView === 'solo-results' || currentView === 'group-results') && <main className="flex-1 min-h-0 overflow-y-auto py-4"><ResultList results={results} onBack={handleBack} onRefresh={handleRefresh} isLoading={isLoading} isExploreMode={isExploreMode} isSolo={currentView === 'solo-results'} location={location} onVote={handleVote} showVote={showVote} cuisineVote={lastIntent?.cuisineVote} memberCount={lastMembers.length} conflicts={lastIntent?.conflicts} emptySuggestions={emptySuggestions} onApplySuggestion={handleApplySuggestion} onFeedback={handleFeedback} budgetCompromise={lastIntent?.budgetCompromise} /></main>}
      {currentView === 'vote' && <main className="flex-1 min-h-0 overflow-y-auto py-4"><VoteView restaurants={results} members={lastMembers} onBack={() => setCurrentView('group-results')} onSelect={handleVoteSelect} /></main>}
      {currentView === 'footprint' && <main className="flex-1 min-h-0 overflow-y-auto py-4"><TabErrorBoundary><FootprintView onReselect={handleHistoryReselect} /></TabErrorBoundary></main>}
      {currentView === 'profile' && <main className="flex-1 min-h-0 overflow-y-auto py-4"><TabErrorBoundary><ProfileView location={location} onOpenFootprint={() => setCurrentView('footprint')} /></TabErrorBoundary></main>}
      {showTabBar && <TabBar activeView={currentView} onChange={handleTabChange} />}
    </div>
    </TabErrorBoundary>
  );
}

export default App;
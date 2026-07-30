/**
 * GA4 分析埋点服务
 * 使用方式：在 .env 中设置 VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX
 * 未配置时所有调用自动空操作，不影响功能
 *
 * 埋点策略：只保留对产品复盘迭代有直接价值的事件
 * - feedback: 推荐策略调整的黄金数据
 * - search + results_shown: 了解搜索需求和空结果率
 * - reroll: 衡量推荐满意度
 * - navigate: 终极转化指标
 * - favorite: 长期意愿信号
 * - mode_select: 功能使用占比
 */

const MEASUREMENT_ID = import.meta.env.VITE_GA_MEASUREMENT_ID || '';

function gtag() {
  if (typeof window !== 'undefined' && window.gtag && MEASUREMENT_ID) {
    window.gtag(...arguments);
  }
}

// ============ 页面浏览 ============

export function trackPageView(pageName, params = {}) {
  if (!MEASUREMENT_ID) return;
  gtag('event', 'page_view', {
    page_title: pageName,
    page_location: window.location.href,
    ...params,
  });
}

// ============ 核心事件 ============

/**
 * 用户选择具体模式（决定功能投入方向）
 */
export function trackModeSelect(modeKey, modeLabel) {
  gtag('event', 'mode_select', {
    event_category: 'engagement',
    mode_key: modeKey,
    mode_label: modeLabel,
  });
}

/**
 * 用户发起搜索
 */
export function trackSearch(type, { searchText = '', memberCount = 1, hasPrefFilter = false } = {}) {
  gtag('event', 'search', {
    event_category: 'core',
    search_type: type,
    has_text: !!searchText,
    member_count: memberCount,
    has_pref_filter: hasPrefFilter,
  });
}

/**
 * 推荐结果展示（重点关注 is_empty 空结果率）
 */
export function trackResultsShown(resultCount, modeType, isEmpty = false) {
  gtag('event', 'results_shown', {
    event_category: 'core',
    result_count: resultCount,
    mode_type: modeType,
    is_empty: isEmpty,
  });
}

/**
 * 点击再来一个（换一批频率 = 推荐满意度）
 */
export function trackReroll(modeType, cycleCount = 1) {
  gtag('event', 'reroll', {
    event_category: 'engagement',
    mode_type: modeType,
    cycle_count: cycleCount,
  });
}

/**
 * 用户反馈：喜欢/不喜欢（推荐算法迭代黄金数据）
 */
export function trackFeedback(type, { cuisine = '', price = 0, rating = 0 } = {}) {
  gtag('event', 'feedback', {
    event_category: 'engagement',
    feedback_type: type,
    cuisine,
    price_level: price > 100 ? 'high' : price > 50 ? 'mid' : 'low',
    rating_level: rating >= 4.5 ? 'high' : rating >= 4 ? 'mid' : 'low',
  });
}

/**
 * 收藏/取消收藏（长期意愿信号）
 */
export function trackFavorite(action, cuisine = '') {
  gtag('event', 'favorite', {
    event_category: 'engagement',
    action,
    cuisine,
  });
}

/**
 * 点击导航过去（终极转化指标）
 */
export function trackNavigate(restaurantName = '') {
  gtag('event', 'navigate', {
    event_category: 'conversion',
    restaurant_name: restaurantName,
  });
}

// ============ 诊断 ============

export function isAnalyticsEnabled() {
  return !!MEASUREMENT_ID;
}

export function getMeasurementId() {
  return MEASUREMENT_ID;
}

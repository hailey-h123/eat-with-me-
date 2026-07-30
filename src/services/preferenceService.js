const STORAGE_KEY = 'eatwithme_preferences';
const MAX_PREFERENCES = 10;

export function getPreferences(mode = null) {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    const all = data ? JSON.parse(data) : [];
    if (mode) {
      return all.filter(p => p.mode === mode);
    }
    return all;
  } catch (error) {
    console.error('[preferenceService] 读取偏好失败:', error);
    return [];
  }
}

export function savePreference(members, mode = 'group') {
  try {
    const preferences = getPreferences();
    const newPreference = {
      id: Date.now(),
      timestamp: Date.now(),
      mode,
      members: members.map(m => ({ name: m.name, text: m.text })),
      summary: members.map(m => `${m.name}: ${m.text}`).join(' | ')
    };
    
    const filtered = preferences.filter(p => p.summary !== newPreference.summary);
    filtered.unshift(newPreference);
    
    const trimmed = filtered.slice(0, MAX_PREFERENCES);
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
    return trimmed;
  } catch (error) {
    console.error('[preferenceService] 保存偏好失败:', error);
    return [];
  }
}

export function deletePreference(id) {
  try {
    const preferences = getPreferences();
    const filtered = preferences.filter(p => p.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return filtered;
  } catch (error) {
    console.error('[preferenceService] 删除偏好失败:', error);
    return [];
  }
}

export function clearPreferences() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return [];
  } catch (error) {
    console.error('[preferenceService] 清空偏好失败:', error);
    return [];
  }
}
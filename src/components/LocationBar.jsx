import { useState, useEffect } from 'react';
import { IconMapPin, IconLoader2, IconAlertCircle, IconEdit2, IconX, IconCheck } from './icons/FancyIcons';

export default function LocationBar({
  location,
  isLocating,
  error,
  debugInfo,
  onLocationChange,
  onRetry
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(location.name);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    if (error && !isLocating) {
      setIsEditing(true);
      setEditValue('');
    }
  }, [error, isLocating]);

  const handleSave = async () => {
    if (!editValue.trim()) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const result = await onLocationChange({
        name: editValue.trim(),
        lat: null,
        lng: null,
      });
      if (result && result.success) {
        setIsEditing(false);
      }
    } catch (err) {
      setSaveError(err.message || '保存失败，请重试');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditValue(location.name);
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSave();
    else if (e.key === 'Escape') handleCancel();
  };

  const handleEdit = () => {
    setEditValue(location.name);
    setIsEditing(true);
  };

  return (
    <div className="flex items-center justify-center py-1.5 sm:py-3">
      {isLocating ? (
        <div className="location-bar max-w-[88%] sm:max-w-2xl">
          <IconLoader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin text-primary" />
          <span className="text-text-secondary text-[11px] sm:text-xs">正在定位...</span>
          <button
            onClick={() => { setEditValue(''); setIsEditing(true); }}
            className="ml-1 text-primary/70 hover:text-primary text-[11px] sm:text-xs font-medium transition-colors"
          >
            手动设置
          </button>
        </div>
      ) : isEditing ? (
        <div className="flex flex-col items-center gap-1 w-full px-2">
          <div className="location-bar w-full sm:max-w-2xl">
            <IconMapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary flex-shrink-0" />
            <input
              type="text"
              value={editValue}
              onChange={(e) => { setEditValue(e.target.value); if (saveError) setSaveError(null); }}
              onKeyDown={handleKeyDown}
              autoFocus
              disabled={isSaving}
              className="bg-transparent text-text text-[12px] sm:text-base flex-1 min-w-0 focus:outline-none disabled:opacity-50 placeholder:text-text-muted"
              placeholder="输入位置，如：望京、三里屯"
            />
            {isSaving ? (
              <IconLoader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin text-text-muted" />
            ) : (
              <>
                <button onClick={handleSave} className="p-1 sm:p-2 text-primary hover:text-primary-dark transition-colors" title="保存">
                  <IconCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </button>
                <button onClick={handleCancel} className="p-1 sm:p-2 text-text-muted hover:text-text-secondary transition-colors" title="取消">
                  <IconX className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                </button>
              </>
            )}
          </div>
          {saveError && (
            <div className="flex items-center gap-1 text-error text-[10px] sm:text-xs mt-1 animate-slide-up">
              <IconAlertCircle className="w-3 h-3" />
              <span>{saveError}</span>
            </div>
          )}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center gap-1 sm:gap-2 w-full px-2">
          <div className="location-bar max-w-[88%] sm:max-w-2xl">
            <IconAlertCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-error" />
            <span className="text-error text-[11px] sm:text-xs font-medium min-w-0 truncate">{error}</span>
            <button onClick={handleEdit} className="text-primary text-[11px] sm:text-xs font-medium hover:opacity-80 transition-opacity whitespace-nowrap">手动设置</button>
            <button onClick={onRetry} className="text-text-muted text-[11px] sm:text-xs hover:text-primary transition-colors whitespace-nowrap">重试</button>
          </div>
          {debugInfo && debugInfo.length > 0 && (
            <div className="mt-1 px-3 py-1.5 sm:py-2 bg-surface rounded-xl text-[10px] sm:text-xs text-text-muted max-w-xs shadow-sm">
              {debugInfo.map((msg, i) => <div key={i} className="truncate">{msg}</div>)}
            </div>
          )}
        </div>
      ) : (
        <button
          onClick={handleEdit}
          type="button"
          className="location-bar max-w-[88%] sm:max-w-2xl hover:border-primary/20 transition-all duration-200 group"
        >
          <IconMapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary/60 group-hover:text-primary transition-colors flex-shrink-0" />
          <span className="text-text-secondary text-[11px] sm:text-xs font-medium min-w-0 truncate max-w-[62vw] sm:max-w-[500px]">{location?.name || '未定位'}</span>
          <IconEdit2 className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-text-muted group-hover:text-primary transition-colors flex-shrink-0" />
        </button>
      )}
    </div>
  );
}

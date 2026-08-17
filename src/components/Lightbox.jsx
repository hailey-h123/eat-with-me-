import { useEffect, useCallback } from 'react';
import { IconCross, IconChevronLeft, IconChevronRight } from './icons/FancyIcons';

export default function Lightbox({ photos, currentIndex, onClose, onPrev, onNext }) {
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'ArrowLeft' && photos.length > 1) onPrev();
    if (e.key === 'ArrowRight' && photos.length > 1) onNext();
  }, [onClose, onPrev, onNext, photos.length]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  // 弹窗打开时锁定背景滚动，仅针对触摸设备（手机/平板），桌面端保留滚动
  useEffect(() => {
    const isTouchDevice = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
    if (!isTouchDevice) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const photo = photos[currentIndex];
  if (!photo) return null;

  return (
    <div role="dialog" aria-modal="true" aria-label="图片预览">
      <div className="fixed inset-0 z-[99] bg-black/75" onClick={onClose} />

      {/* 关闭按钮 */}
      <button
        onClick={onClose}
        aria-label="关闭"
        className="fixed top-4 right-4 w-11 h-11 rounded-full bg-black/30 hover:bg-black/45 ring-1 ring-white/25 flex items-center justify-center z-[101] transition-all"
      >
        <IconCross className="w-5 h-5 text-white" />
      </button>

      {/* 图片 */}
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-12 pointer-events-none"
      >
        <img
          src={photo.url}
          alt={photo.title || '餐厅图片'}
          className="max-w-full max-h-[55vh] object-contain pointer-events-auto"
          draggable={false}
        />
      </div>

      {/* 图片标题 */}
      {photo.title && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 px-5 py-2 rounded-full bg-black/30 ring-1 ring-white/20 text-white text-sm z-[101]">
          {photo.title}
        </div>
      )}

      {/* 计数 */}
      {photos.length > 1 && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-black/30 ring-1 ring-white/20 text-white text-sm z-[101]">
          {currentIndex + 1} / {photos.length}
        </div>
      )}

      {/* 左右切换 */}
      {photos.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onPrev(); }}
          aria-label="上一张"
          className="fixed left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/30 hover:bg-black/45 ring-1 ring-white/25 flex items-center justify-center z-[101] transition-all"
        >
          <IconChevronLeft className="w-5 h-5 text-white" />
        </button>
      )}

      {photos.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); onNext(); }}
          aria-label="下一张"
          className="fixed right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/30 hover:bg-black/45 ring-1 ring-white/25 flex items-center justify-center z-[101] transition-all"
        >
          <IconChevronRight className="w-5 h-5 text-white" />
        </button>
      )}
    </div>
  );
}

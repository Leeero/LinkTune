import { useEffect } from 'react';
import { usePlayer } from '../PlayerContext';

/**
 * 全局快捷键支持
 * - 空格：播放/暂停
 * - 左箭头：上一首
 * - 右箭头：下一首
 * - 上箭头：音量增加
 * - 下箭头：音量减少
 * - M：静音切换
 */
export function useGlobalShortcuts() {
  const player = usePlayer();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 忽略输入框中的按键
      const target = e.target as HTMLElement;
      const tagName = target.tagName.toLowerCase();
      if (tagName === 'input' || tagName === 'textarea' || target.isContentEditable) {
        return;
      }

      switch (e.code) {
        case 'Space':
          e.preventDefault();
          void player.toggle();
          break;

        case 'ArrowLeft':
          // Ctrl/Cmd + Left：后退 5 秒
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            player.seek(Math.max(0, player.currentTime - 5));
          } else {
            e.preventDefault();
            void player.playPrev();
          }
          break;

        case 'ArrowRight':
          // Ctrl/Cmd + Right：前进 5 秒
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            player.seek(Math.min(player.duration, player.currentTime + 5));
          } else {
            e.preventDefault();
            void player.playNext();
          }
          break;

        case 'ArrowUp':
          e.preventDefault();
          player.setVolume(Math.min(1, player.volume + 0.1));
          break;

        case 'ArrowDown':
          e.preventDefault();
          player.setVolume(Math.max(0, player.volume - 0.1));
          break;

        case 'KeyM':
          e.preventDefault();
          player.toggleMuted();
          break;

        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [player]);
}

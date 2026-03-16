import { CloseOutlined, DeleteOutlined } from '@ant-design/icons';
import { Button, Typography } from 'antd';
import { useEffect, useRef } from 'react';

import { usePlayer } from '../../player/PlayerContext';

interface MobileQueueSheetProps {
  open: boolean;
  onClose: () => void;
}

export function MobileQueueSheet({ open, onClose }: MobileQueueSheetProps) {
  const player = usePlayer();
  const listRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  // 打开时滚动到当前播放歌曲
  useEffect(() => {
    if (open && activeRef.current && listRef.current) {
      const listRect = listRef.current.getBoundingClientRect();
      const activeRect = activeRef.current.getBoundingClientRect();
      const scrollTop = activeRect.top - listRect.top - listRect.height / 2 + activeRect.height / 2;
      listRef.current.scrollTop += scrollTop;
    }
  }, [open]);

  // 防止背景滚动
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  return (
    <>
      {/* 遮罩层 */}
      <div
        className="mobile-sheet-overlay"
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 2100,
          opacity: open ? 1 : 0,
          transition: 'opacity 200ms ease',
        }}
      />

      {/* Sheet 内容 */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 2101,
          maxHeight: '70vh',
          background: 'var(--linktune-glass-bg-light)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRadius: '16px 16px 0 0',
          display: 'flex',
          flexDirection: 'column',
          transform: open ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 300ms cubic-bezier(0.32, 0.72, 0, 1)',
        }}
        className="mobile-queue-sheet"
      >
        {/* 拖动指示条 */}
        <div
          style={{
            width: 36,
            height: 4,
            background: 'rgba(0, 0, 0, 0.2)',
            borderRadius: 2,
            margin: '8px auto',
          }}
        />

        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 16px 12px',
            borderBottom: '0.5px solid rgba(0, 0, 0, 0.06)',
          }}
        >
          <Typography.Text strong style={{ fontSize: 17 }}>
            播放队列 ({player.totalCount})
          </Typography.Text>
          <Button
            type="text"
            icon={<CloseOutlined />}
            onClick={onClose}
            style={{ width: 40, height: 40 }}
          />
        </div>

        {/* 队列列表 */}
        <div
          ref={listRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '4px 0',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {player.tracks.length === 0 ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 120,
                color: 'var(--lt-text-secondary)',
                fontSize: 14,
              }}
            >
              播放队列为空
            </div>
          ) : (
            player.tracks.map((track, index) => {
              const isCurrent = index === player.currentIndex;
              return (
                <button
                  key={`${track.id}-${index}`}
                  ref={isCurrent ? activeRef : undefined}
                  type="button"
                  onClick={() => {
                    void player.playTrack(track);
                    onClose();
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 16px',
                    background: isCurrent ? 'rgba(64, 117, 255, 0.08)' : 'transparent',
                    border: 'none',
                    borderBottom: '0.5px solid rgba(0, 0, 0, 0.04)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 150ms ease',
                  }}
                >
                  {/* 序号 / 播放动画 */}
                  {isCurrent ? (
                    <div className="mobile-song-item__playing-indicator">
                      <span /><span /><span />
                    </div>
                  ) : (
                    <span
                      style={{
                        width: 24,
                        fontSize: 13,
                        fontWeight: 500,
                        color: 'var(--lt-text-secondary)',
                        textAlign: 'center',
                        flexShrink: 0,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {index + 1}
                    </span>
                  )}

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: isCurrent ? 600 : 400,
                        color: isCurrent ? 'var(--linktune-primary)' : 'var(--lt-text)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        lineHeight: 1.4,
                      }}
                    >
                      {track.title}
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: 'var(--lt-text-secondary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        marginTop: 2,
                        lineHeight: 1.4,
                      }}
                    >
                      {track.artist || '未知歌手'}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* 底部操作 */}
        <div
          style={{
            padding: '12px 16px',
            paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))',
            borderTop: '0.5px solid rgba(0, 0, 0, 0.06)',
          }}
        >
          <Button
            block
            icon={<DeleteOutlined />}
            onClick={() => player.clearQueue()}
            style={{ borderRadius: 10 }}
          >
            清空队列
          </Button>
        </div>
      </div>
    </>
  );
}

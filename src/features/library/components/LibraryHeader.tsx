import { Button, Input, Space, Tag, Typography } from 'antd';

export function LibraryHeader(props: {
  pageTitle: string;
  connectionTitle: string;
  isEmby: boolean;
  isCustom: boolean;
  songsCount: number;
  total: number;
  isPlaylistMode: boolean;

  searchInput: string;
  onSearchInputChange: (v: string) => void;
  onSearchCommit: () => void;

  playAllLoading: boolean;
  playAllDisabled: boolean;
  onPlayAll: () => void;
}) {
  const {
    pageTitle,
    connectionTitle,
    isEmby,
    isCustom,
    songsCount,
    total,
    isPlaylistMode,
    searchInput,
    onSearchInputChange,
    onSearchCommit,
    playAllLoading,
    playAllDisabled,
    onPlayAll,
  } = props;

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
      <div>
        <Typography.Title level={3} style={{ marginBottom: 0 }}>
          {pageTitle}
        </Typography.Title>
        <Space size={8} wrap style={{ marginTop: 6 }}>
          {connectionTitle ? <Tag color="blue">{connectionTitle}</Tag> : null}
          <Typography.Text type="secondary">
            {(isEmby || isCustom) ? `已加载 ${songsCount.toLocaleString()} / ${total.toLocaleString()} 首` : ''}
          </Typography.Text>
        </Space>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {!isCustom && (
          <Input
            style={{ width: 320, maxWidth: '100%' }}
            allowClear
            placeholder={isPlaylistMode ? '搜索歌单内歌曲 / 歌手 / 专辑（服务端搜索）' : '搜索歌曲 / 歌手 / 专辑（服务端搜索）'}
            value={searchInput}
            onChange={(e) => onSearchInputChange(e.target.value)}
            onPressEnter={onSearchCommit}
          />
        )}

        <Button type="primary" loading={playAllLoading} disabled={playAllDisabled} onClick={onPlayAll}>
          播放全部
        </Button>
      </div>
    </div>
  );
}

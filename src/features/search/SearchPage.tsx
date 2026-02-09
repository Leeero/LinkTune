import { PlayCircleOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { Alert, Button, Empty, Input, Segmented, Space, Spin, Typography, theme } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { loadAudioQuality } from '../../config/audioQualityConfig';
import { usePlayer } from '../../player/PlayerContext';
import type { Track } from '../../player/types';
import { buildCustomAudioUrl, customParseSongs, type CustomPlatform, type CustomSong } from '../../protocols/custom/library';
import { customSearchSongs, type SearchResult } from '../../protocols/custom/search';
import { useAuth } from '../../session/AuthProvider';
import { SongsTable } from '../library/components/SongsTable';
import type { UnifiedSong } from '../library/types';
import { joinArtists } from '../library/utils/format';
import { AddToPlaylistModal } from '../local-playlists/AddToPlaylistModal';
import type { LocalPlaylistSong } from '../local-playlists/localPlaylistDB';

const PLATFORM_OPTIONS = [
  { label: '网易云', value: 'netease' },
  { label: 'QQ音乐', value: 'qq' },
  { label: '酷我', value: 'kuwo' },
];

export function SearchPage() {
  const { token } = theme.useToken();
  const auth = useAuth();
  const player = usePlayer();

  const [keyword, setKeyword] = useState('');
  const [platform, setPlatform] = useState<CustomPlatform>('netease');
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const tableWrapRef = useRef<HTMLDivElement | null>(null);
  const [tableBodyY, setTableBodyY] = useState<number>(420);

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [songToAdd, setSongToAdd] = useState<LocalPlaylistSong | null>(null);

  // 自动调整表格高度
  useEffect(() => {
    const el = tableWrapRef.current;
    if (!el) return;

    const ro = new ResizeObserver(() => {
      const h = el.getBoundingClientRect().height;
      const bodyY = Math.max(220, Math.floor(h - 60));
      setTableBodyY(bodyY);
    });

    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 执行搜索
  const doSearch = useCallback(async (overridePlatform?: CustomPlatform) => {
    const c = auth.credentials;
    if (!c || c.protocol !== 'custom') return;
    if (!keyword.trim()) return;

    const searchPlatform = overridePlatform ?? platform;

    setLoading(true);
    setError(null);
    setSearched(true);

    try {
      const res = await customSearchSongs({
        credentials: c,
        platform: searchPlatform,
        keyword: keyword.trim(),
        page: 1,
        pageSize: 50,
      });
      setResult(res);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '搜索失败';
      setError(msg);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [auth.credentials, keyword, platform]);

  // 按回车搜索
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        void doSearch();
      }
    },
    [doSearch],
  );

  // 切换平台时重新搜索
  const handlePlatformChange = useCallback(
    (val: string | number) => {
      const newPlatform = val as CustomPlatform;
      setPlatform(newPlatform);
      // 如果已经搜索过，切换平台时自动重新搜索
      // 传入新平台值，避免闭包捕获旧值的问题
      if (searched && keyword.trim()) {
        void doSearch(newPlatform);
      }
    },
    [doSearch, keyword, searched],
  );

  // 构建 Track 对象
  const buildTrack = useCallback(
    (row: CustomSong): Track | null => {
      const c = auth.credentials;
      if (!c || c.protocol !== 'custom') return null;

      const quality = loadAudioQuality(c.protocol);
      const songPlatform = row.platform || platform;

      const buildUrl = async (q: typeof quality): Promise<string> => {
        const syncUrl = buildCustomAudioUrl({
          credentials: c,
          song: row,
          platform: songPlatform,
          quality: q,
        });
        if (syncUrl) return syncUrl;

        const parsed = await customParseSongs({
          credentials: c,
          platform: songPlatform,
          ids: row.id,
          quality: q,
        });

        if (parsed.length === 0) {
          throw new Error('无法获取播放链接');
        }

        const first = parsed[0];
        if (!first.success || !first.url) {
          throw new Error('无法获取播放链接');
        }

        return first.url;
      };

      return {
        id: row.id,
        title: row.name,
        artist: joinArtists(row.artists),
        url: '',
        protocol: c.protocol,
        quality,
        buildUrl,
        platform: songPlatform,
        artists: row.artists,
        coverUrl: row.cover,
      };
    },
    [auth.credentials, platform],
  );

  // 添加到歌单
  const handleAddToPlaylist = useCallback(
    (row: CustomSong) => {
      setSongToAdd({
        id: row.id,
        name: row.name,
        artists: row.artists,
        platform: row.platform || platform,
        addedAt: Date.now(),
      });
      setAddModalOpen(true);
    },
    [platform],
  );

  // 播放全部搜索结果
  const handlePlayAll = useCallback(async () => {
    if (!result || result.songs.length === 0) return;

    const seen = new Set<string>();
    const tracks = result.songs
      .map((s) => {
        const t = buildTrack(s);
        if (!t) return null;
        if (seen.has(t.id)) return null;
        seen.add(t.id);
        return t;
      })
      .filter(Boolean) as Track[];

    await player.playTracks(tracks, 0);
  }, [buildTrack, player, result]);

  // 表格列定义
  const columns: ColumnsType<UnifiedSong> = useMemo(() => {
    return [
      {
        title: '歌曲',
        dataIndex: 'name',
        key: 'name',
        ellipsis: true,
        render: (_: unknown, row) => {
          const isCurrent = player.currentTrack?.id === row.id;
          const artist = joinArtists(row.artists);

          return (
            <Space size={10} style={{ minWidth: 0 }}>
              <Button
                type={isCurrent ? 'primary' : 'text'}
                icon={<PlayCircleOutlined />}
                onClick={async () => {
                  const t = buildTrack(row as CustomSong);
                  if (!t) return;
                  await player.playTrack(t);
                }}
              />
              <Button
                type="text"
                icon={<PlusOutlined />}
                onClick={() => handleAddToPlaylist(row as CustomSong)}
                title="添加到歌单"
              />

              <div style={{ minWidth: 0 }}>
                <Typography.Text strong style={{ color: token.colorText }} ellipsis>
                  {row.name}
                </Typography.Text>
                <div>
                  <Typography.Text style={{ color: token.colorTextSecondary }} ellipsis>
                    {artist}
                  </Typography.Text>
                </div>
              </div>
            </Space>
          );
        },
      },
    ];
  }, [buildTrack, handleAddToPlaylist, player, token.colorText, token.colorTextSecondary]);

  // 非 custom 协议时显示提示
  if (!auth.credentials || auth.credentials.protocol !== 'custom') {
    return <Alert type="warning" showIcon message="搜索功能仅支持 TuneHub 协议" />;
  }

  const songs = result?.songs || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
      {/* 搜索头部 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Typography.Title level={3} style={{ marginBottom: 0 }}>
          搜索
        </Typography.Title>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Input
            placeholder="输入歌曲名、歌手名搜索"
            prefix={<SearchOutlined style={{ color: token.colorTextTertiary }} />}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{ width: 320 }}
            allowClear
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={() => doSearch()} loading={loading}>
            搜索
          </Button>
          <Segmented options={PLATFORM_OPTIONS} value={platform} onChange={handlePlatformChange} />
        </div>
      </div>

      {/* 搜索结果 */}
      {error && <Alert type="error" showIcon message={error} />}

      {loading ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spin size="large" tip="搜索中..." />
        </div>
      ) : searched && songs.length === 0 && !error ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Empty
            description={
              <span>
                未找到相关歌曲
                <br />
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {platform === 'qq' ? '提示：QQ 音乐接口可能暂时不可用，请尝试其他平台' : '尝试换个关键词或切换平台'}
                </Typography.Text>
              </span>
            }
          />
        </div>
      ) : songs.length > 0 ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography.Text type="secondary">
              共找到 {result?.total?.toLocaleString() || songs.length} 首歌曲
            </Typography.Text>
            <Button type="primary" onClick={handlePlayAll}>
              播放全部
            </Button>
          </div>

          <SongsTable
            tableWrapRef={tableWrapRef}
            songs={songs}
            columns={columns}
            loading={false}
            tableBodyY={tableBodyY}
            onRowDoubleClick={async (row) => {
              const t = buildTrack(row as CustomSong);
              if (!t) return;
              await player.playTrack(t);
            }}
          />
        </>
      ) : !searched ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Empty description="输入关键词开始搜索" image={Empty.PRESENTED_IMAGE_SIMPLE} />
        </div>
      ) : null}

      <AddToPlaylistModal
        open={addModalOpen}
        onClose={() => {
          setAddModalOpen(false);
          setSongToAdd(null);
        }}
        song={songToAdd}
      />
    </div>
  );
}

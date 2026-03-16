import {
  CustomerServiceOutlined,
  FireOutlined,
  FolderOutlined,
  HistoryOutlined,
  SearchOutlined,
  UnorderedListOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import { useAuth } from '../../session/AuthProvider';

interface NavItem {
  key: string;
  icon: React.ReactNode;
  label: string;
  /** 判断当前路径是否匹配此 Tab */
  match: (path: string) => boolean;
  /** 点击时实际跳转的路由（如果与 key 不同） */
  navigateTo?: string;
}

/**
 * Custom 协议（TuneHub）的底部导航
 * 参考 QQ音乐：发现 | 搜索 | 歌单 | 历史 | 我的
 */
const CUSTOM_NAV_ITEMS: NavItem[] = [
  {
    key: 'discover',
    icon: <FireOutlined />,
    label: '发现',
    match: (path) =>
      path === '/' || path.startsWith('/toplists'),
    navigateTo: '/toplists/netease',
  },
  {
    key: 'search',
    icon: <SearchOutlined />,
    label: '搜索',
    match: (path) => path === '/search',
    navigateTo: '/search',
  },
  {
    key: 'playlists',
    icon: <FolderOutlined />,
    label: '歌单',
    match: (path) =>
      path === '/local-playlists' || path.startsWith('/local-playlists/'),
    navigateTo: '/local-playlists',
  },
  {
    key: 'history',
    icon: <HistoryOutlined />,
    label: '历史',
    match: (path) => path === '/history',
    navigateTo: '/history',
  },
  {
    key: 'me',
    icon: <UserOutlined />,
    label: '我的',
    match: (path) => path === '/settings',
    navigateTo: '/settings',
  },
];

/**
 * Emby 协议的底部导航
 * 参考网易云音乐：音乐库 | 歌单 | 搜索 | 我的
 */
const EMBY_NAV_ITEMS: NavItem[] = [
  {
    key: 'library',
    icon: <CustomerServiceOutlined />,
    label: '音乐库',
    match: (path) => path === '/' || path === '/library',
    navigateTo: '/library',
  },
  {
    key: 'playlists',
    icon: <UnorderedListOutlined />,
    label: '歌单',
    match: (path) => path === '/playlists' || path.startsWith('/playlists/'),
    navigateTo: '/playlists',
  },
  {
    key: 'search',
    icon: <SearchOutlined />,
    label: '搜索',
    match: (path) => path === '/search',
    navigateTo: '/search',
  },
  {
    key: 'me',
    icon: <UserOutlined />,
    label: '我的',
    match: (path) => path === '/settings',
    navigateTo: '/settings',
  },
];

/**
 * Navidrome 协议的底部导航（功能最少：没有歌单、没有历史）
 */
const NAVIDROME_NAV_ITEMS: NavItem[] = [
  {
    key: 'library',
    icon: <CustomerServiceOutlined />,
    label: '音乐库',
    match: (path) => path === '/' || path === '/library',
    navigateTo: '/library',
  },
  {
    key: 'search',
    icon: <SearchOutlined />,
    label: '搜索',
    match: (path) => path === '/search',
    navigateTo: '/search',
  },
  {
    key: 'me',
    icon: <UserOutlined />,
    label: '我的',
    match: (path) => path === '/settings',
    navigateTo: '/settings',
  },
];

export function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();

  const protocol = auth.credentials?.protocol;

  // 根据协议选择对应的导航项
  const navItems = useMemo<NavItem[]>(() => {
    if (protocol === 'custom') return CUSTOM_NAV_ITEMS;
    if (protocol === 'emby') return EMBY_NAV_ITEMS;
    // navidrome 或其他
    return NAVIDROME_NAV_ITEMS;
  }, [protocol]);

  // 计算当前激活的Tab
  const activeKey = useMemo(() => {
    const path = location.pathname;
    for (const item of navItems) {
      if (item.match(path)) return item.key;
    }
    return navItems[0]?.key ?? '';
  }, [location.pathname, navItems]);

  const handleNavClick = (item: NavItem) => {
    const target = item.navigateTo ?? `/${item.key}`;
    navigate(target);
  };

  return (
    <nav className="mobile-nav">
      {navItems.map((item) => (
        <button
          key={item.key}
          type="button"
          className={`mobile-nav__item ${activeKey === item.key ? 'is-active' : ''}`}
          onClick={() => handleNavClick(item)}
        >
          <span className="mobile-nav__icon">{item.icon}</span>
          <span className="mobile-nav__label">{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

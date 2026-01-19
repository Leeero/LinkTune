import type { ThemeConfig } from 'antd';
import { theme } from 'antd';

export type ThemeMode = 'light' | 'dark';

// 设计意图：
// - 主色（深海蓝）：科技/连接感
// - 点缀（轻青紫）：音乐/律动
// - 深浅两套：长时间使用舒适

type Token = NonNullable<ThemeConfig['token']>;

const COMMON_TOKEN: Token = {
  colorSuccess: '#00C48C',
  colorWarning: '#FFB547',
  colorError: '#FF6262',
  colorInfo: '#86909C',

  borderRadius: 10,
  wireframe: false,
};

const LIGHT_TOKEN: Token = {
  ...COMMON_TOKEN,

  colorPrimary: '#1E5EFF',
  colorPrimaryHover: '#4075FF',
  colorPrimaryActive: '#1849D6',
  colorPrimaryBg: '#EEF4FF',

  colorText: '#1D2129',
  colorTextSecondary: '#4E5969',
  colorTextTertiary: '#86909C',

  colorBgLayout: '#F7F8FA',
  colorBgContainer: '#FFFFFF',
  colorBorder: '#E5E6EB',
};

const DARK_TOKEN: Token = {
  ...COMMON_TOKEN,

  // 深色背景下主色稍提亮，增强对比
  colorPrimary: '#4075FF',
  colorPrimaryHover: '#5C8CFF',
  colorPrimaryActive: '#1E5EFF',
  colorPrimaryBg: '#0E1933',

  // 深海蓝系布局底色 + 面板色
  colorBgLayout: '#0B1220',
  colorBgContainer: '#141B2D',
  colorBorder: 'rgba(255,255,255,.10)',

  colorText: '#E5E6EB',
  colorTextSecondary: '#C9CDD4',
  colorTextTertiary: '#86909C',
};

export function getLinkTuneTheme(mode: ThemeMode): ThemeConfig {
  const isDark = mode === 'dark';
  const token = isDark ? DARK_TOKEN : LIGHT_TOKEN;

  return {
    algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token,
    components: {
      Button: {
        borderRadius: 10,
        controlHeight: 36,
      },
      Card: {
        borderRadiusLG: 14,
      },
      Layout: {
        headerBg: 'transparent',
        bodyBg: token.colorBgLayout,
      },
      Menu: {
        itemBorderRadius: 10,
        itemMarginBlock: 4,
        itemMarginInline: 8,
      },
      Slider: {
        // 点缀色：音乐律动
        handleColor: '#9D7CFF',
        handleActiveColor: '#9D7CFF',
        trackBg: token.colorPrimary,
        trackHoverBg: token.colorPrimaryHover,
      },
      Typography: {
        titleMarginTop: 0,
        titleMarginBottom: 0,
      },
    },
  };
}

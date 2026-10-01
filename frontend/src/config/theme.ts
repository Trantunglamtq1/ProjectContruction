import type { ThemeConfig } from 'antd';

export const themeConfig: ThemeConfig = {
  token: {
    colorPrimary: '#1677FF',
    colorSuccess: '#52C41A',
    colorWarning: '#FAAD14',
    colorError: '#FF4D4F',
    colorInfo: '#1677FF',
    colorTextBase: '#1F2937',
    colorTextSecondary: '#595959',
    colorBgBase: '#F5F7FA',
    colorBgContainer: '#FFFFFF',
    colorBorder: '#E4E7ED',
    borderRadius: 4,
    fontFamily: "'Public Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontSize: 14,
    lineHeight: 1.5,
  },
  components: {
    Button: {
      borderRadius: 4,
      controlHeight: 38,
      fontWeight: 500,
    },
    Input: {
      borderRadius: 4,
      controlHeight: 38,
    },
    Card: {
      borderRadiusLG: 8,
    },
    Table: {
      borderRadius: 4,
      headerBg: '#FAFAFA',
      headerColor: '#1F2937',
    },
    Tag: {
      borderRadiusSM: 4,
    },
  },
};

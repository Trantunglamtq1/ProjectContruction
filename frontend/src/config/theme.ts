import type { ThemeConfig } from 'antd';

// Preserve tokens used to author saved absolute-positioned forms.
export const geometryTheme: ThemeConfig = {
  inherit: false,
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

export const themeConfig: ThemeConfig = {
  token: {
    colorPrimary: '#1D4ED8', colorInfo: '#1D4ED8', colorSuccess: '#166534', colorWarning: '#92400E', colorError: '#B42318',
    colorText: '#182230', colorTextSecondary: '#475467', colorTextDescription: '#475467', colorTextTertiary: '#475467', colorTextPlaceholder: '#667085',
    colorBgBase: '#FFFFFF', colorBgLayout: '#F6F7F9', colorBgContainer: '#FFFFFF',
    colorBorder: '#98A2B3', colorBorderSecondary: '#E4E7EC', colorSplit: '#EAECF0', borderRadius: 4,
    fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif", fontSize: 14, lineHeight: 1.5, controlHeight: 34, controlHeightSM: 28,
  },
  components: {
    Button: { fontWeight: 500, primaryShadow: 'none', defaultShadow: 'none', dangerShadow: 'none' },
    Card: { borderRadiusLG: 6, headerFontSize: 15, bodyPadding: 20 },
    Table: { headerBg: '#F9FAFB', headerColor: '#475467', headerBorderRadius: 0, cellPaddingBlock: 12, cellPaddingInline: 16, rowHoverBg: '#F8FAFC' },
    Menu: { itemHeight: 40, itemMarginInline: 8, itemMarginBlock: 4, itemSelectedBg: '#EFF4FF', itemSelectedColor: '#1D4ED8', itemColor: '#475467', itemBorderRadius: 4 },
    Tabs: { titleFontSize: 14, horizontalItemGutter: 24 },
    Tag: { borderRadiusSM: 4, defaultColor: '#344054' },
    Drawer: { footerPaddingBlock: 12, footerPaddingInline: 20 },
  },
};

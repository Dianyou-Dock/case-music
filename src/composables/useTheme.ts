import { computed, ref } from 'vue'
import { darkTheme, type GlobalThemeOverrides } from 'naive-ui'

// 定义主题颜色
export const appGreen = '#1DB954'
export const appBlue = '#007AFF'

// ---- 全局共享状态 ----
const themeRef = ref<typeof darkTheme | null>(darkTheme)
const isDarkTheme = computed(() => themeRef.value !== null)
const themeColor = computed(() => isDarkTheme.value ? appGreen : appBlue)

// ---- 主题覆盖 ----
const lightThemeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: appBlue,
    primaryColorHover: appBlue,
    primaryColorPressed: appBlue,
    textColorBase: appBlue,
    bodyColor: '#FFFFFF'
  },
  Layout: {
    siderColor: '#FAFAFA',
    footerColor: '#F0F0F0'
  },
  Menu: {
    itemTextColor: appBlue,
    itemIconColor: appBlue,
    itemTextColorHover: appBlue,
    itemIconColorHover: appBlue,
    itemColorActive: '#E0E0E0'
  },
  Button: {
    textColor: '#FFFFFF',
    textColorPrimary: '#FFFFFF',
    textColorHover: '#FFFFFF',
    textColorPressed: '#FFFFFF',
    textColorFocus: '#FFFFFF',
    colorPrimary: appBlue,
    colorHoverPrimary: appBlue,
    colorPressedPrimary: appBlue,
    colorFocusPrimary: appBlue
  },
  Card: {
    color: '#FFFFFF',
    borderRadius: '8px'
  },
  Input: {
    color: '#F5F5F5',
    colorFocus: '#F5F5F5',
    textColor: appBlue,
    placeholderColor: appBlue,
    border: `1px solid ${appBlue}`,
    borderHover: `1px solid ${appBlue}`,
    borderFocus: `1px solid ${appBlue}`,
    borderRadius: '4px'
  },
  Form: {
    labelTextColor: appBlue
  }
}

const darkThemeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: appGreen,
    primaryColorHover: appGreen,
    primaryColorPressed: appGreen,
    textColorBase: appGreen,
    bodyColor: '#121212'
  },
  Layout: {
    siderColor: '#1E1E1E',
    footerColor: '#1A1A1A'
  },
  Menu: {
    itemTextColor: appGreen,
    itemIconColor: appGreen,
    itemTextColorHover: appGreen,
    itemIconColorHover: appGreen,
    itemColorActive: '#282828'
  },
  Button: {
    textColor: '#FFFFFF',
    textColorPrimary: '#FFFFFF',
    textColorHover: '#FFFFFF',
    textColorPressed: '#FFFFFF',
    textColorFocus: '#FFFFFF',
    colorPrimary: appGreen,
    colorHoverPrimary: appGreen,
    colorPressedPrimary: appGreen,
    colorFocusPrimary: appGreen
  },
  Card: {
    color: '#1E1E1E',
    borderRadius: '8px'
  },
  Input: {
    color: '#282828',
    colorFocus: '#282828',
    textColor: appGreen,
    placeholderColor: appGreen,
    border: `1px solid ${appGreen}`,
    borderHover: `1px solid ${appGreen}`,
    borderFocus: `1px solid ${appGreen}`,
    borderRadius: '4px'
  },
  Form: {
    labelTextColor: appGreen
  }
}

const currentThemeOverrides = computed(() => themeRef.value === null ? lightThemeOverrides : darkThemeOverrides)

const toggleTheme = () => {
  themeRef.value = themeRef.value === null ? darkTheme : null
}

export const useTheme = () => {
  return {
    themeRef,
    currentThemeOverrides,
    toggleTheme,
    isDarkTheme,
    themeColor
  }
}

export default useTheme 
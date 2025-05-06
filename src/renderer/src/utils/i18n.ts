import { createI18n } from 'vue-i18n';
import messages from '../locales';

// 语言类型
type LocaleType = 'zh-CN' | 'en-US';

// 获取系统语言或使用英文作为默认语言
const getDefaultLocale = (): LocaleType => {
  const browserLang = navigator.language;
  // 检查浏览器语言是否为中文
  if (browserLang.startsWith('zh')) {
    return 'zh-CN';
  }
  return 'en-US'; // 默认使用英文
};

// 从本地存储获取语言设置
const getSavedLocale = (): LocaleType => {
  const savedLocale = localStorage.getItem('locale');
  return (savedLocale === 'zh-CN' || savedLocale === 'en-US') 
    ? savedLocale 
    : getDefaultLocale();
};

// 创建i18n实例
export const i18n = createI18n({
  legacy: false, // 使用Composition API模式
  locale: getSavedLocale(), // 优先使用本地存储的语言设置
  fallbackLocale: 'en-US', // 备用语言（当找不到翻译时使用）
  messages,
  // 禁用编译功能，避免CSP问题
  runtimeOnly: true,
  // 禁用HTML消息以防止XSS
  warnHtmlMessage: false,
  // 避免使用Function构造器
  warnHtmlInMessage: 'off',
  // 简单模式下不需要编译
  allowComposition: true
});

// 切换语言
export const setLocale = (locale: LocaleType): void => {
  i18n.global.locale.value = locale;
  localStorage.setItem('locale', locale);
};

// 获取当前语言
export const getCurrentLocale = (): LocaleType => {
  return i18n.global.locale.value as LocaleType;
};

// 检查是否为英文
export const isEnglish = (): boolean => {
  return getCurrentLocale() === 'en-US';
};

// 检查是否为中文
export const isChinese = (): boolean => {
  return getCurrentLocale() === 'zh-CN';
}; 
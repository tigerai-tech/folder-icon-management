import { message } from 'ant-design-vue';
import { i18n } from './i18n';

// 获取i18n实例的t函数
const t = i18n.global.t;

/**
 * 显示成功消息
 * @param content 消息内容
 */
export const showSuccess = (content: string): void => {
  message.success(content);
};

/**
 * 显示错误消息
 * @param content 消息内容
 */
export const showError = (content: string): void => {
  message.error(content);
};

/**
 * 显示信息消息
 * @param content 消息内容
 */
export const showInfo = (content: string): void => {
  message.info(content);
};

/**
 * 显示警告消息
 * @param content 消息内容
 */
export const showWarning = (content: string): void => {
  message.warning(content);
}; 
import { createDiscreteApi } from 'naive-ui';
import type { MessageApi } from 'naive-ui';

// 单例消息实例
let messageInstance: MessageApi | null = null;

/**
 * 获取消息API实例
 * @returns 消息API实例
 */
export const getMessage = (): MessageApi => {
  if (!messageInstance) {
    const { message } = createDiscreteApi(['message']);
    messageInstance = message;
  }
  return messageInstance;
};

/**
 * 显示成功消息
 * @param content 消息内容
 */
export const showSuccess = (content: string): void => {
  getMessage().success(content);
};

/**
 * 显示错误消息
 * @param content 消息内容
 */
export const showError = (content: string): void => {
  getMessage().error(content);
};

/**
 * 显示信息消息
 * @param content 消息内容
 */
export const showInfo = (content: string): void => {
  getMessage().info(content);
};

/**
 * 显示警告消息
 * @param content 消息内容
 */
export const showWarning = (content: string): void => {
  getMessage().warning(content);
}; 
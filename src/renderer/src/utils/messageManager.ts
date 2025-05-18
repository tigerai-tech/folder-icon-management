import { message, Modal } from 'ant-design-vue';
import { i18n } from './i18n';

i18n.global.t;

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

/**
 * 显示确认对话框
 * @param title 标题
 * @param content 内容
 * @returns Promise<boolean> 用户确认为true，取消为false
 */
export const showConfirm = (title: string, content: string): Promise<boolean> => {
  return new Promise((resolve) => {
    Modal.confirm({
      title,
      content,
      okText: '确认',
      cancelText: '取消',
      onOk: () => {
        resolve(true);
      },
      onCancel: () => {
        resolve(false);
      }
    });
  });
}; 
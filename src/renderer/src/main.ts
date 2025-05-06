import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'

// 导入Ant Design
import Antd from 'ant-design-vue';
import 'ant-design-vue/dist/antd.css';

// 导入国际化配置
import { i18n } from './utils/i18n';

const app = createApp(App)

// 使用Ant Design
app.use(Antd);

// 使用国际化
app.use(i18n);

app.mount('#app')

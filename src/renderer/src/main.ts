import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'
import {
  create,
  NMessageProvider,
  NDialogProvider,
  NCard,
  NSpace,
  NTabs,
  NTabPane,
  NUpload,
  NUploadDragger,
  NGradientText,
  NButton,
  NGrid,
  NGridItem,
  NImage,
  NScrollbar,
  NDivider,
  NAlert,
  NIcon
} from 'naive-ui'

// 导入Ant Design
import Antd from 'ant-design-vue';
import 'ant-design-vue/dist/antd.css';

// 导入国际化配置
import { i18n } from './utils/i18n';

const naive = create({
  components: [
    NMessageProvider,
    NDialogProvider,
    NCard,
    NSpace,
    NTabs,
    NTabPane,
    NUpload,
    NUploadDragger,
    NGradientText,
    NButton,
    NGrid,
    NGridItem,
    NImage,
    NScrollbar,
    NDivider,
    NAlert,
    NIcon
  ]
})

const app = createApp(App)
app.use(naive)

// 使用Ant Design
app.use(Antd);

// 使用国际化
app.use(i18n);

app.mount('#app')

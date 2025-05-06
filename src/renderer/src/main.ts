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
app.mount('#app')

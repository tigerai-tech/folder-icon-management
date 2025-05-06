<template>
  <div class="language-selector">
    <a-select 
      v-model:value="currentLocale" 
      style="width: 100px"
      @change="handleLocaleChange"
    >
      <a-select-option value="zh-CN">中文</a-select-option>
      <a-select-option value="en-US">English</a-select-option>
    </a-select>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted } from 'vue';
import { getCurrentLocale, setLocale } from '../../utils/i18n';

export default defineComponent({
  name: 'LanguageSelector',
  setup() {
    const currentLocale = ref(getCurrentLocale());

    const handleLocaleChange = (value: string) => {
      if (value === 'zh-CN' || value === 'en-US') {
        setLocale(value);
        currentLocale.value = value;
      }
    };

    onMounted(() => {
      currentLocale.value = getCurrentLocale();
    });

    return {
      currentLocale,
      handleLocaleChange
    };
  }
});
</script>

<style scoped>
.language-selector {
  margin-right: 16px;
}
</style> 
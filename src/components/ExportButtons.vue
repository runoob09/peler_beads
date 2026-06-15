<script setup lang="ts">
import { ref } from 'vue'
import type { DisplaySettings, ExportConfig } from '../types'
import ExportModal from './ExportModal.vue'

defineProps<{
  hasGrid: boolean
  defaultDisplay: DisplaySettings
  gridCols: number
  gridRows: number
}>()

const emit = defineEmits<{
  'export': [config: ExportConfig]
  'save-project': [withImage: boolean]
  'load-project': []
}>()

const showModal = ref(false)
</script>

<template>
  <div class="export-buttons">
    <label class="label">项目</label>
    <button class="btn save-btn" :disabled="!hasGrid" @click="$emit('save-project', true)">保存项目</button>
    <button class="btn save-btn" :disabled="!hasGrid" @click="$emit('save-project', false)">保存项目（不含图片）</button>
    <button class="btn load-btn" @click="$emit('load-project')">加载项目</button>

    <hr class="divider" />

    <button class="btn export-trigger" :disabled="!hasGrid" @click="showModal = true">导出图纸</button>

    <ExportModal
      :visible="showModal"
      :defaultDisplay="defaultDisplay"
      :gridCols="gridCols"
      :gridRows="gridRows"
      @close="showModal = false"
      @export="config => emit('export', config)"
    />
  </div>
</template>

<style scoped>
.export-buttons { display: flex; flex-direction: column; gap: 6px; }
.label { font-size: 13px; color: var(--text); font-weight: 500; }
.btn { padding: 8px; border-radius: 6px; border: 1px solid var(--border); cursor: pointer; font-size: 13px; }
.btn:disabled { opacity: 0.4; cursor: not-allowed; }
.export-trigger { background: var(--accent); color: #fff; border-color: var(--accent); }
.save-btn { background: var(--bg); color: var(--text-h); }
.load-btn { background: var(--bg); color: var(--text-h); }
.divider { border: none; border-top: 1px solid var(--border); margin: 4px 0; }
</style>

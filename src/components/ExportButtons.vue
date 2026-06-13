<script setup lang="ts">
defineProps<{ hasGrid: boolean }>()
defineEmits<{
  'export-png': []
  'export-pdf': []
  'save-project': [withImage: boolean]
  'load-project': []
}>()
</script>

<template>
  <div class="export-buttons">
    <label class="label">导出</label>
    <button class="btn export-btn" :disabled="!hasGrid" @click="$emit('export-png')">导出 PNG</button>
    <button class="btn export-btn" :disabled="!hasGrid" @click="$emit('export-pdf')">导出 PDF</button>
    <hr class="divider" />
    <button class="btn save-btn" :disabled="!hasGrid" @click="$emit('save-project', true)">保存项目</button>
    <button class="btn save-btn" :disabled="!hasGrid" @click="$emit('save-project', false)">保存项目（不含图片）</button>
    <button class="btn load-btn" @click="$emit('load-project')">加载项目</button>
  </div>
</template>

<style scoped>
.export-buttons { display: flex; flex-direction: column; gap: 6px; }
.label { font-size: 13px; color: var(--text); font-weight: 500; }
.btn { padding: 8px; border-radius: 6px; border: 1px solid var(--border); cursor: pointer; font-size: 13px; }
.btn:disabled { opacity: 0.4; cursor: not-allowed; }
.export-btn { background: var(--accent); color: #fff; border-color: var(--accent); }
.save-btn { background: var(--bg); color: var(--text-h); }
.load-btn { background: var(--bg); color: var(--text-h); }
.divider { border: none; border-top: 1px solid var(--border); margin: 4px 0; }
</style>

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
    <label class="label">项目</label>
    <button class="btn save-btn" :disabled="!hasGrid" @click="$emit('save-project', true)">保存项目</button>
    <button class="btn save-btn" :disabled="!hasGrid" @click="$emit('save-project', false)">保存项目（不含图片）</button>
    <button class="btn load-btn" @click="$emit('load-project')">加载项目</button>

    <hr class="divider" />

    <details class="export-details">
      <summary class="export-summary">导出图纸</summary>
      <div class="export-submenu">
        <button class="btn export-btn" :disabled="!hasGrid" @click="$emit('export-png')">导出 PNG</button>
        <button class="btn export-btn" :disabled="!hasGrid" @click="$emit('export-pdf')">导出 PDF</button>
      </div>
    </details>
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

.export-details { margin: 0; }
.export-summary {
  font-size: 13px; color: var(--text); font-weight: 500;
  cursor: pointer; padding: 4px 0; user-select: none;
  list-style: none;
}
.export-summary::-webkit-details-marker { display: none; }
.export-summary::marker { display: none; content: ''; }
.export-summary::before {
  content: '▸ ';
  display: inline-block;
  transition: transform 0.2s;
  font-size: 10px;
  vertical-align: middle;
}
.export-details[open] .export-summary::before { content: '▾ '; }

.export-submenu {
  display: flex; flex-direction: column; gap: 4px;
  padding: 6px 0 0 10px;
}
</style>

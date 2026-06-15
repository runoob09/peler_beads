<script setup lang="ts">
import { reactive, watch } from 'vue'
import type { ExportConfig, DisplaySettings } from '../types'

const props = defineProps<{
  visible: boolean
  defaultDisplay: DisplaySettings
  gridCols: number
  gridRows: number
}>()

const emit = defineEmits<{
  close: []
  export: [config: ExportConfig]
}>()

const config = reactive<ExportConfig>({
  format: 'png',
  cellSize: 20,
  filename: '',
  showGrid: true,
  gridLineColor: '#cccccc',
  gridLineWidth: 1,
  boldGridInterval: 10,
  boldGridColor: '#000000',
  boldGridWidth: 2,
})

watch(() => props.visible, (v) => {
  if (v) {
    config.format = 'png'
    config.cellSize = 20
    config.filename = `拼豆图案_${props.gridCols}x${props.gridRows}`
    config.showGrid = props.defaultDisplay.showGrid
    config.gridLineColor = props.defaultDisplay.gridLineColor
    config.gridLineWidth = props.defaultDisplay.gridLineWidth
    config.boldGridInterval = props.defaultDisplay.boldGridInterval
    config.boldGridColor = props.defaultDisplay.boldGridColor
    config.boldGridWidth = props.defaultDisplay.boldGridWidth
  }
})

function confirm() {
  emit('export', { ...config })
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div v-if="visible" class="modal-backdrop" @click.self="emit('close')">
      <div class="modal">
        <div class="modal-header">
          <h3>导出图纸</h3>
          <button class="close-btn" @click="emit('close')">&times;</button>
        </div>

        <div class="modal-body">
          <label class="field">
            <span class="field-label">格式</span>
            <select v-model="config.format">
              <option value="png">PNG 图片</option>
              <option value="pdf">PDF 文档</option>
            </select>
          </label>

          <label class="field">
            <span class="field-label">文件名</span>
            <input v-model="config.filename" type="text" class="text-input" />
          </label>

          <label class="field">
            <span class="field-label">珠子大小</span>
            <div class="slider-row">
              <input v-model.number="config.cellSize" type="range" min="8" max="60" />
              <span class="value">{{ config.cellSize }}px</span>
            </div>
          </label>

          <fieldset class="grid-section">
            <legend>
              <label class="checkbox-label">
                <input v-model="config.showGrid" type="checkbox" />
                <span>显示网格线</span>
              </label>
            </legend>

            <template v-if="config.showGrid">
              <label class="field">
                <span class="field-label">网格颜色</span>
                <input v-model="config.gridLineColor" type="color" />
              </label>

              <label class="field">
                <span class="field-label">网格粗细</span>
                <div class="slider-row">
                  <input v-model.number="config.gridLineWidth" type="range" min="0" max="5" step="0.5" />
                  <span class="value">{{ config.gridLineWidth }}</span>
                </div>
              </label>

              <label class="field">
                <span class="field-label">粗线间隔</span>
                <div class="slider-row">
                  <input v-model.number="config.boldGridInterval" type="range" min="0" max="30" />
                  <span class="value">{{ config.boldGridInterval || '关' }}</span>
                </div>
              </label>

              <template v-if="config.boldGridInterval > 0">
                <label class="field">
                  <span class="field-label">粗线颜色</span>
                  <input v-model="config.boldGridColor" type="color" />
                </label>
                <label class="field">
                  <span class="field-label">粗线粗细</span>
                  <div class="slider-row">
                    <input v-model.number="config.boldGridWidth" type="range" min="1" max="6" step="0.5" />
                    <span class="value">{{ config.boldGridWidth }}</span>
                  </div>
                </label>
              </template>
            </template>
          </fieldset>
        </div>

        <div class="modal-footer">
          <button class="btn cancel-btn" @click="emit('close')">取消</button>
          <button class="btn confirm-btn" @click="confirm">导出</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal-backdrop {
  position: fixed; inset: 0; background: rgba(0, 0, 0, 0.4);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000;
}
.modal {
  background: var(--bg); border-radius: 12px;
  width: 380px; max-height: 85vh; overflow-y: auto;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}
.modal-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px 0;
}
.modal-header h3 { margin: 0; font-size: 16px; color: var(--text-h); }
.close-btn {
  background: none; border: none; font-size: 20px; cursor: pointer;
  color: var(--text); padding: 0; line-height: 1;
}
.modal-body {
  padding: 16px 20px; display: flex; flex-direction: column; gap: 12px;
}
.modal-footer {
  padding: 0 20px 16px; display: flex; gap: 8px; justify-content: flex-end;
}

.field { display: flex; flex-direction: column; gap: 4px; }
.field-label { font-size: 12px; color: var(--text); }
select, .text-input {
  padding: 6px 10px; border: 1px solid var(--border); border-radius: 6px;
  font-size: 13px; background: var(--bg); color: var(--text-h);
}
.text-input { width: 100%; box-sizing: border-box; }

.slider-row { display: flex; align-items: center; gap: 8px; }
.slider-row input[type="range"] { flex: 1; }
.value { font-size: 12px; color: var(--text); font-family: var(--mono, monospace); min-width: 30px; }

.grid-section {
  border: 1px solid var(--border); border-radius: 8px; padding: 12px;
  display: flex; flex-direction: column; gap: 8px;
}
.grid-section legend { padding: 0 4px; }
.checkbox-label {
  display: flex; align-items: center; gap: 6px; font-size: 13px;
  color: var(--text-h); cursor: pointer;
}

.btn { padding: 8px 20px; border-radius: 6px; border: 1px solid var(--border); cursor: pointer; font-size: 13px; }
.cancel-btn { background: var(--bg); color: var(--text); }
.confirm-btn { background: var(--accent); color: #fff; border-color: var(--accent); }
</style>

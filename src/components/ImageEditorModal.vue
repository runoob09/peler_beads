<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useImageEditor, type CropRect } from '../composables/useImageEditor'

const props = defineProps<{
  show: boolean
  imageFile: File | null
}>()

const emit = defineEmits<{
  confirm: [file: File]
  cancel: []
}>()

const editor = useImageEditor()
const { state, previewCanvas } = editor
const containerRef = ref<HTMLDivElement>()
const filterDebounce = ref<ReturnType<typeof setTimeout>>()

// Crop drag state
interface DragState {
  type: 'move' | 'resize-nw' | 'resize-ne' | 'resize-sw' | 'resize-se' | 'resize-n' | 'resize-s' | 'resize-e' | 'resize-w'
  startX: number
  startY: number
  startRect: CropRect
}

const drag = ref<DragState | null>(null)

// Watch show + imageFile to load image
watch(
  () => [props.show, props.imageFile] as const,
  async ([show, file]) => {
    if (show && file) {
      await nextTick()
      await editor.loadImage(file)
      fitCanvas()
    }
  },
)

function fitCanvas() {
  const canvas = previewCanvas.value
  const container = containerRef.value
  if (!canvas || !container || !state.sourceImage) return
  const maxW = container.clientWidth - 16
  const maxH = container.clientHeight - 16
  canvas.width = maxW || 400
  canvas.height = maxH || 300
  editor.render()
}

function onResize() {
  fitCanvas()
}

onMounted(() => {
  window.addEventListener('resize', onResize)
})
onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  if (filterDebounce.value) clearTimeout(filterDebounce.value)
})

function onFilterInput(type: 'brightness' | 'contrast' | 'saturation', event: Event) {
  const value = parseInt((event.target as HTMLInputElement).value)
  editor.setFilter(type, value)
  if (filterDebounce.value) clearTimeout(filterDebounce.value)
  filterDebounce.value = setTimeout(() => editor.render(), 50)
}

// Compute image coordinates from mouse event
function imageCoordsFromEvent(e: MouseEvent) {
  const canvas = previewCanvas.value
  if (!canvas || !state.sourceImage) return { x: 0, y: 0, scale: 1, offsetX: 0, offsetY: 0 }
  const rect = canvas.getBoundingClientRect()
  const cx = e.clientX - rect.left
  const cy = e.clientY - rect.top

  const crop = state.cropRect
  const sw = crop?.w ?? state.sourceImage.naturalWidth
  const sh = crop?.h ?? state.sourceImage.naturalHeight
  const isVertical = state.rotation === 90 || state.rotation === 270
  const outW = isVertical ? sh : sw
  const outH = isVertical ? sw : sh
  const scale = Math.min(canvas.width / outW, canvas.height / outH)
  const dw = outW * scale
  const dh = outH * scale
  const ox = (canvas.width - dw) / 2
  const oy = (canvas.height - dh) / 2

  return { x: (cx - ox) / scale, y: (cy - oy) / scale, scale, offsetX: ox, offsetY: oy }
}

function hitTestResizeHandle(ix: number, iy: number): DragState['type'] | null {
  const rect = state.cropRect
  if (!rect) return null
  const hs = 8
  if (Math.abs(ix - rect.x) < hs && Math.abs(iy - rect.y) < hs) return 'resize-nw'
  if (Math.abs(ix - rect.x - rect.w) < hs && Math.abs(iy - rect.y) < hs) return 'resize-ne'
  if (Math.abs(ix - rect.x) < hs && Math.abs(iy - rect.y - rect.h) < hs) return 'resize-sw'
  if (Math.abs(ix - rect.x - rect.w) < hs && Math.abs(iy - rect.y - rect.h) < hs) return 'resize-se'
  if (Math.abs(ix - rect.x) < 4 && iy >= rect.y && iy <= rect.y + rect.h) return 'resize-w'
  if (Math.abs(ix - rect.x - rect.w) < 4 && iy >= rect.y && iy <= rect.y + rect.h) return 'resize-e'
  if (Math.abs(iy - rect.y) < 4 && ix >= rect.x && ix <= rect.x + rect.w) return 'resize-n'
  if (Math.abs(iy - rect.y - rect.h) < 4 && ix >= rect.x && ix <= rect.x + rect.w) return 'resize-s'
  if (ix >= rect.x && ix <= rect.x + rect.w && iy >= rect.y && iy <= rect.y + rect.h) return 'move'
  return null
}

function onCropMouseDown(e: MouseEvent) {
  if (!state.cropEnabled) return
  const coords = imageCoordsFromEvent(e)
  const hit = hitTestResizeHandle(coords.x, coords.y)
  if (hit && state.cropRect) {
    drag.value = { type: hit, startX: coords.x, startY: coords.y, startRect: { ...state.cropRect } }
  } else if (!hit) {
    state.cropRect = { x: coords.x, y: coords.y, w: 1, h: 1 }
    drag.value = { type: 'resize-se', startX: coords.x, startY: coords.y, startRect: { x: coords.x, y: coords.y, w: 1, h: 1 } }
  }
}

function onCropMouseMove(e: MouseEvent) {
  if (!drag.value || !state.cropRect) return
  const coords = imageCoordsFromEvent(e)
  const dx = coords.x - drag.value.startX
  const dy = coords.y - drag.value.startY
  const sr = drag.value.startRect
  let newRect: CropRect

  switch (drag.value.type) {
    case 'move':
      newRect = { x: sr.x + dx, y: sr.y + dy, w: sr.w, h: sr.h }
      break
    case 'resize-se': newRect = { x: sr.x, y: sr.y, w: sr.w + dx, h: sr.h + dy }; break
    case 'resize-sw': newRect = { x: sr.x + dx, y: sr.y, w: sr.w - dx, h: sr.h + dy }; break
    case 'resize-ne': newRect = { x: sr.x, y: sr.y + dy, w: sr.w + dx, h: sr.h - dy }; break
    case 'resize-nw': newRect = { x: sr.x + dx, y: sr.y + dy, w: sr.w - dx, h: sr.h - dy }; break
    case 'resize-n': newRect = { x: sr.x, y: sr.y + dy, w: sr.w, h: sr.h - dy }; break
    case 'resize-s': newRect = { x: sr.x, y: sr.y, w: sr.w, h: sr.h + dy }; break
    case 'resize-e': newRect = { x: sr.x, y: sr.y, w: sr.w + dx, h: sr.h }; break
    case 'resize-w': newRect = { x: sr.x + dx, y: sr.y, w: sr.w - dx, h: sr.h }; break
    default: return
  }

  if (newRect.w < 0) { newRect.x += newRect.w; newRect.w = -newRect.w }
  if (newRect.h < 0) { newRect.y += newRect.h; newRect.h = -newRect.h }

  editor.setCropRect(newRect)
  editor.render()
}

function onCropMouseUp() {
  drag.value = null
}

async function onConfirm() {
  try {
    const blob = await editor.getEditedBlob()
    const file = new File([blob], props.imageFile?.name ?? 'edited.png', { type: 'image/png' })
    emit('confirm', file)
  } catch {
    if (props.imageFile) emit('confirm', props.imageFile)
  }
}

function onCancel() {
  emit('cancel')
}
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="editor-modal" @click.self="onCancel">
      <div class="editor-dialog">
        <div class="editor-header">
          <span>图片编辑</span>
          <button class="btn-close" @click="onCancel">✕</button>
        </div>
        <div class="editor-body">
          <!-- Left toolbar -->
          <div class="editor-tools">
            <button data-test="btn-crop" :class="{ active: state.cropEnabled }" @click="editor.setCropEnabled(!state.cropEnabled)">
              ✂️ 裁剪
            </button>
            <button data-test="btn-rotate-cw" @click="editor.rotate('cw'); editor.render()">↻ 旋转</button>
            <button data-test="btn-rotate-ccw" @click="editor.rotate('ccw'); editor.render()">↺ 旋转</button>
            <button data-test="btn-flip-h" @click="editor.flip('h'); editor.render()">↔ 水平翻转</button>
            <button data-test="btn-flip-v" @click="editor.flip('v'); editor.render()">↕ 垂直翻转</button>
            <button data-test="btn-reset" class="btn-reset" @click="editor.reset(); editor.render()">重置</button>
          </div>

          <!-- Center preview -->
          <div ref="containerRef" class="editor-preview">
            <canvas
              ref="previewCanvas"
              :style="{ cursor: state.cropEnabled ? 'crosshair' : 'default' }"
              @mousedown="onCropMouseDown"
              @mousemove="onCropMouseMove"
              @mouseup="onCropMouseUp"
              @mouseleave="onCropMouseUp"
            />
          </div>

          <!-- Right filters -->
          <div class="editor-filters">
            <label>
              亮度
              <input data-test="slider-brightness" type="range" min="0" max="200" :value="state.brightness" @input="onFilterInput('brightness', $event)" />
              <span>{{ state.brightness }}</span>
            </label>
            <label>
              对比度
              <input data-test="slider-contrast" type="range" min="0" max="200" :value="state.contrast" @input="onFilterInput('contrast', $event)" />
              <span>{{ state.contrast }}</span>
            </label>
            <label>
              饱和度
              <input data-test="slider-saturation" type="range" min="0" max="200" :value="state.saturation" @input="onFilterInput('saturation', $event)" />
              <span>{{ state.saturation }}</span>
            </label>
          </div>
        </div>
        <div class="editor-footer">
          <button data-test="btn-cancel" class="btn-cancel" @click="onCancel">取消</button>
          <button data-test="btn-confirm" class="btn-confirm" @click="onConfirm">确认</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.editor-modal {
  position: fixed; inset: 0; background: rgba(0,0,0,0.6);
  display: flex; align-items: center; justify-content: center; z-index: 1000;
}
.editor-dialog {
  background: var(--bg, #fff); border-radius: 12px;
  width: 90vw; max-width: 1100px; max-height: 90vh;
  display: flex; flex-direction: column; overflow: hidden;
}
.editor-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 12px 20px; border-bottom: 1px solid var(--border, #e5e4e7);
  font-size: 16px; font-weight: 600;
}
.btn-close { background: none; border: none; font-size: 18px; cursor: pointer; color: var(--text, #6b6375); }
.editor-body { display: flex; flex: 1; min-height: 0; }
.editor-tools {
  width: 120px; flex-shrink: 0; padding: 12px 8px;
  display: flex; flex-direction: column; gap: 6px;
  border-right: 1px solid var(--border, #e5e4e7);
}
.editor-tools button {
  padding: 6px 10px; border: 1px solid var(--border, #e5e4e7);
  border-radius: 6px; background: var(--bg, #fff); cursor: pointer;
  font-size: 13px; text-align: left;
}
.editor-tools button:hover { background: var(--accent-bg, rgba(170,59,255,0.08)); }
.editor-tools button.active { border-color: var(--accent, #aa3bff); background: rgba(170,59,255,0.12); }
.editor-tools .btn-reset { color: #dc2626; border-color: #fecaca; }
.editor-preview {
  flex: 1; display: flex; align-items: center; justify-content: center;
  background: #f0f0f0; min-height: 300px; overflow: hidden; padding: 8px;
}
.editor-preview canvas { max-width: 100%; max-height: 100%; }
.editor-filters {
  width: 160px; flex-shrink: 0; padding: 12px;
  display: flex; flex-direction: column; gap: 16px;
  border-left: 1px solid var(--border, #e5e4e7);
}
.editor-filters label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--text, #6b6375); }
.editor-filters input[type="range"] { width: 100%; }
.editor-filters span { text-align: right; font-family: monospace; }
.editor-footer {
  display: flex; justify-content: flex-end; gap: 12px;
  padding: 12px 20px; border-top: 1px solid var(--border, #e5e4e7);
}
.btn-cancel {
  padding: 6px 20px; border: 1px solid var(--border, #e5e4e7);
  border-radius: 6px; background: var(--bg, #fff); cursor: pointer; font-size: 13px;
}
.btn-confirm {
  padding: 6px 20px; border: none; border-radius: 6px;
  background: var(--accent, #aa3bff); color: #fff; cursor: pointer; font-size: 13px;
}
</style>

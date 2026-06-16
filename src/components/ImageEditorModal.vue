<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useImageEditor } from '../composables/useImageEditor'

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
type DragMode = 'create' | 'move'
  | 'resize-nw' | 'resize-ne' | 'resize-sw' | 'resize-se'
  | 'resize-n' | 'resize-s' | 'resize-e' | 'resize-w'

const dragMode = ref<DragMode | null>(null)
const dragStart = ref({ x: 0, y: 0 })
const dragStartRect = ref({ x: 0, y: 0, w: 0, h: 0 })
const cursorStyle = ref('crosshair')

// rAF throttle for crop drag renders
let renderRafId = 0
function scheduleRender() {
  if (renderRafId) return
  renderRafId = requestAnimationFrame(() => {
    renderRafId = 0
    editor.render()
  })
}

const HANDLE = 8  // corner handle hit radius (in image coords)
const EDGE = 4     // edge hit radius

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
  if (renderRafId) { cancelAnimationFrame(renderRafId); renderRafId = 0 }
})

function onFilterInput(type: 'brightness' | 'contrast' | 'saturation', event: Event) {
  const value = parseInt((event.target as HTMLInputElement).value)
  editor.setFilter(type, value)
  if (filterDebounce.value) clearTimeout(filterDebounce.value)
  filterDebounce.value = setTimeout(() => editor.render(), 50)
}

// Compute image coordinates from mouse event, clamping to image bounds
function imageCoordsFromEvent(e: MouseEvent): { x: number; y: number } | null {
  const canvas = previewCanvas.value
  if (!canvas || !state.sourceImage) return null
  const rect = canvas.getBoundingClientRect()
  const cx = e.clientX - rect.left
  const cy = e.clientY - rect.top

  const imgW = state.sourceImage.naturalWidth
  const imgH = state.sourceImage.naturalHeight
  const isVertical = state.rotation === 90 || state.rotation === 270
  const outW = isVertical ? imgH : imgW
  const outH = isVertical ? imgW : imgH
  const scale = Math.min(canvas.width / outW, canvas.height / outH)
  const dw = outW * scale
  const dh = outH * scale
  const ox = (canvas.width - dw) / 2
  const oy = (canvas.height - dh) / 2

  const ix = (cx - ox) / scale
  const iy = (cy - oy) / scale

  // Clamp to image bounds (don't return null — allow drag along edges)
  return { x: clampTo(ix, 0, imgW), y: clampTo(iy, 0, imgH) }
}

function clampTo(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

// Check if a crop rect covers the full source image (i.e. is the default, not a user selection)
function isFullImageRect(r: { x: number; y: number; w: number; h: number }): boolean {
  const img = state.sourceImage
  if (!img) return false
  return r.x <= 0 && r.y <= 0 && r.x + r.w >= img.naturalWidth && r.y + r.h >= img.naturalHeight
}

// Hit-test crop rect: returns the drag mode for a given image-coordinate point.
// Returns null when the crop rect is the full-image default (user hasn't made a selection yet).
function hitTest(ix: number, iy: number): DragMode | null {
  const r = state.cropRect
  if (!r || r.w === 0 || r.h === 0) return null // no rect yet or still creating
  if (isFullImageRect(r)) return null // full-image default — treat as "no selection"

  // corners
  if (Math.abs(ix - r.x) < HANDLE && Math.abs(iy - r.y) < HANDLE) return 'resize-nw'
  if (Math.abs(ix - r.x - r.w) < HANDLE && Math.abs(iy - r.y) < HANDLE) return 'resize-ne'
  if (Math.abs(ix - r.x) < HANDLE && Math.abs(iy - r.y - r.h) < HANDLE) return 'resize-sw'
  if (Math.abs(ix - r.x - r.w) < HANDLE && Math.abs(iy - r.y - r.h) < HANDLE) return 'resize-se'
  // edges
  if (Math.abs(iy - r.y) < EDGE && ix > r.x && ix < r.x + r.w) return 'resize-n'
  if (Math.abs(iy - r.y - r.h) < EDGE && ix > r.x && ix < r.x + r.w) return 'resize-s'
  if (Math.abs(ix - r.x) < EDGE && iy > r.y && iy < r.y + r.h) return 'resize-w'
  if (Math.abs(ix - r.x - r.w) < EDGE && iy > r.y && iy < r.y + r.h) return 'resize-e'
  // inside
  if (ix >= r.x && ix <= r.x + r.w && iy >= r.y && iy <= r.y + r.h) return 'move'

  return null
}

function onCropMouseDown(e: MouseEvent) {
  if (!state.cropEnabled) return
  const coords = imageCoordsFromEvent(e)
  if (!coords) return

  const hit = hitTest(coords.x, coords.y)
  if (hit) {
    // Resize or move existing rect
    dragMode.value = hit
    dragStart.value = { x: coords.x, y: coords.y }
    dragStartRect.value = state.cropRect ? { ...state.cropRect } : { x: 0, y: 0, w: 0, h: 0 }
  } else {
    // Create new selection: reset crop rect to zero-size at click point
    dragMode.value = 'create'
    dragStart.value = { x: coords.x, y: coords.y }
    dragStartRect.value = { x: coords.x, y: coords.y, w: 0, h: 0 }
    // Bypass setCropRect (which enforces min 10) — use raw rect during drag
    state.cropRect = { x: coords.x, y: coords.y, w: 0, h: 0 }
  }
  scheduleRender()
}

function onCropMouseMove(e: MouseEvent) {
  const coords = imageCoordsFromEvent(e)

  if (!dragMode.value) {
    // Not dragging — update cursor based on hover position
    if (coords) {
      const hit = hitTest(coords.x, coords.y)
      if (hit === 'move') cursorStyle.value = 'move'
      else if (hit === 'resize-se' || hit === 'resize-nw') cursorStyle.value = 'nwse-resize'
      else if (hit === 'resize-ne' || hit === 'resize-sw') cursorStyle.value = 'nesw-resize'
      else if (hit === 'resize-n' || hit === 'resize-s') cursorStyle.value = 'ns-resize'
      else if (hit === 'resize-e' || hit === 'resize-w') cursorStyle.value = 'ew-resize'
      else cursorStyle.value = 'crosshair'
    }
    return
  }

  if (!coords) return

  if (dragMode.value === 'create') {
    // Create mode: compute bounding box from start point to current mouse
    const x = Math.min(dragStart.value.x, coords.x)
    const y = Math.min(dragStart.value.y, coords.y)
    const w = Math.abs(coords.x - dragStart.value.x)
    const h = Math.abs(coords.y - dragStart.value.y)
    // Clamp to image bounds during drag
    state.cropRect = editor.clampCropToBounds({ x, y, w, h })
  } else {
    // Move or resize an existing rect
    const dx = coords.x - dragStart.value.x
    const dy = coords.y - dragStart.value.y
    const sr = dragStartRect.value

    if (dragMode.value === 'move') {
      let newRect = editor.clampCropToBounds({ x: sr.x + dx, y: sr.y + dy, w: sr.w, h: sr.h })
      // Re-align drag start so further movement stays proportional
      dragStart.value = { x: coords.x - (sr.x + dx - newRect.x), y: coords.y - (sr.y + dy - newRect.y) }
      dragStartRect.value = newRect
      state.cropRect = newRect
    } else {
      let newRect = { x: sr.x, y: sr.y, w: sr.w, h: sr.h }
      const m = dragMode.value

      if (m === 'resize-se') { newRect.w = sr.w + dx; newRect.h = sr.h + dy }
      else if (m === 'resize-sw') { newRect.x = sr.x + dx; newRect.w = sr.w - dx; newRect.h = sr.h + dy }
      else if (m === 'resize-ne') { newRect.y = sr.y + dy; newRect.w = sr.w + dx; newRect.h = sr.h - dy }
      else if (m === 'resize-nw') { newRect.x = sr.x + dx; newRect.y = sr.y + dy; newRect.w = sr.w - dx; newRect.h = sr.h - dy }
      else if (m === 'resize-n')  { newRect.y = sr.y + dy; newRect.h = sr.h - dy }
      else if (m === 'resize-s')  { newRect.h = sr.h + dy }
      else if (m === 'resize-e')  { newRect.w = sr.w + dx }
      else if (m === 'resize-w')  { newRect.x = sr.x + dx; newRect.w = sr.w - dx }

      if (newRect.w < 0) { newRect.x += newRect.w; newRect.w = -newRect.w }
      if (newRect.h < 0) { newRect.y += newRect.h; newRect.h = -newRect.h }

      state.cropRect = editor.clampCropToBounds(newRect)
    }
  }
  scheduleRender()
}

function onCropMouseUp() {
  // Finalize: apply min-10 clamp via setCropRect
  if (state.cropRect) {
    editor.setCropRect(state.cropRect)
  }
  dragMode.value = null
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
    <div v-if="show" class="editor-modal">
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
              :style="{ cursor: state.cropEnabled ? cursorStyle : 'default' }"
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
  position: fixed; inset: 0; background: var(--bg, #fff);
  display: flex; z-index: 1000;
}
.editor-dialog {
  background: var(--bg, #fff);
  width: 100vw; height: 100vh;
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

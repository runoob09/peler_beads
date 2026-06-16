import { ref, computed, onMounted, onUnmounted } from 'vue'
import { clampZoom, ZOOM_STEP } from './useGridInteraction'

export function useZoomPan(opts?: {
  onTransformChanged?: (panX: number, panY: number, zoom: number) => void
}) {
  const zoom = ref(1)
  const panX = ref(0)
  const panY = ref(0)
  const isPanning = ref(false)
  const panStart = ref({ x: 0, y: 0 })
  const panStartPos = ref({ x: 0, y: 0 })

  const transformStyle = computed(() =>
    `transform: translate(${panX.value}px, ${panY.value}px) scale(${zoom.value})`,
  )

  function onWheel(event: WheelEvent, containerEl: HTMLElement) {
    if (!event.ctrlKey) return
    event.preventDefault()
    const delta = event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP
    const oldZoom = zoom.value
    const newZoom = clampZoom(oldZoom + delta)
    const rect = containerEl.getBoundingClientRect()
    const cx = event.clientX - rect.left
    const cy = event.clientY - rect.top
    const scale = newZoom / oldZoom
    panX.value = cx - scale * (cx - panX.value)
    panY.value = cy - scale * (cy - panY.value)
    zoom.value = newZoom
    opts?.onTransformChanged?.(panX.value, panY.value, zoom.value)
  }

  function onPanStart(event: MouseEvent) {
    isPanning.value = true
    panStart.value = { x: event.clientX, y: event.clientY }
    panStartPos.value = { x: panX.value, y: panY.value }
  }

  function onPanMove(event: MouseEvent) {
    if (!isPanning.value) return
    panX.value = panStartPos.value.x + (event.clientX - panStart.value.x)
    panY.value = panStartPos.value.y + (event.clientY - panStart.value.y)
    opts?.onTransformChanged?.(panX.value, panY.value, zoom.value)
  }

  function onPanEnd() {
    isPanning.value = false
  }

  onMounted(() => {
    document.addEventListener('mousemove', onPanMove)
    document.addEventListener('mouseup', onPanEnd)
  })

  onUnmounted(() => {
    document.removeEventListener('mousemove', onPanMove)
    document.removeEventListener('mouseup', onPanEnd)
  })

  return { zoom, panX, panY, isPanning, transformStyle, onWheel, onPanStart, onPanMove, onPanEnd }
}

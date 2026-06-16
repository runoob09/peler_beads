import { ref, type Ref } from 'vue'

export function useCellSize(
  containerRef: Ref<HTMLElement | undefined | null>,
  grid: Ref<{ rows: number; cols: number } | null>,
  initialSize = 20,
) {
  const cellSize = ref(initialSize)

  function recompute() {
    const container = containerRef.value
    if (!container || !grid.value) return
    const maxW = container.clientWidth || 400
    const maxH = container.clientHeight || 400
    cellSize.value = Math.floor(
      Math.min(maxW / grid.value.cols, maxH / grid.value.rows),
    )
  }

  return { cellSize, recompute }
}

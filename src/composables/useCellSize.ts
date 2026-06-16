import { ref, type Ref } from 'vue'

export function useCellSize(
  containerRef: Ref<HTMLElement | undefined | null>,
  getGrid: () => { rows: number; cols: number } | null | undefined,
  initialSize = 20,
) {
  const cellSize = ref(initialSize)

  function recompute() {
    const container = containerRef.value
    const grid = getGrid()
    if (!container || !grid) return
    const maxW = container.clientWidth || 400
    const maxH = container.clientHeight || 400
    cellSize.value = Math.floor(
      Math.min(maxW / grid.cols, maxH / grid.rows),
    )
  }

  return { cellSize, recompute }
}

import type { BeadGrid } from '../types'

export const MIN_ZOOM = 0.25
export const MAX_ZOOM = 4
export const ZOOM_STEP = 0.1

export function clampZoom(z: number): number {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z))
}

export function getCellFromEvent(
  event: MouseEvent,
  canvas: HTMLCanvasElement,
  grid: BeadGrid | null,
  cellSize: number,
  zoom: number,
): { row: number; col: number } | null {
  const rect = canvas.getBoundingClientRect()
  const x = event.clientX - rect.left
  const y = event.clientY - rect.top
  const scaledCell = cellSize * zoom
  const col = Math.floor(x / scaledCell)
  const row = Math.floor(y / scaledCell)
  if (!grid) return null
  if (row >= 0 && row < grid.rows && col >= 0 && col < grid.cols) {
    return { row, col }
  }
  return null
}

export function zoomTowardCursor(
  oldZoom: number,
  newZoom: number,
  cursorX: number,
  cursorY: number,
  panX: number,
  panY: number,
): { panX: number; panY: number } {
  const scale = newZoom / oldZoom
  return {
    panX: cursorX - scale * (cursorX - panX),
    panY: cursorY - scale * (cursorY - panY),
  }
}

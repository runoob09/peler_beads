import type { BeadGrid, PaletteColor, RenderMode } from '../types'

export interface GridLineSettings {
  showGrid: boolean
  gridLineColor: string
  gridLineWidth: number
  boldGridInterval: number
  boldGridColor: string
  boldGridWidth: number
}

const SYMBOLS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789●▲■◆★♦▼◀▶♠♥♣'

export function buildSymbolMap(palette: PaletteColor[]): Map<number, string> {
  const map = new Map<number, string>()
  palette.forEach((_c, i) => {
    map.set(i, SYMBOLS[i % SYMBOLS.length] ?? '?')
  })
  return map
}

function getTextColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? '#000000' : '#FFFFFF'
}

export function renderGridToCanvas(
  grid: BeadGrid,
  renderMode: RenderMode,
  cellSize: number,
  gridLines: GridLineSettings,
  scale = 1,
): HTMLCanvasElement {
  const width = grid.cols * cellSize * scale
  const height = grid.rows * cellSize * scale
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  ctx.scale(scale, scale)

  const symbolMap = renderMode !== 'color' ? buildSymbolMap(grid.palette) : null

  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      const cell = grid.cells[row][col]
      const color = grid.palette[cell.colorIndex]
      const x = col * cellSize
      const y = row * cellSize

      if (renderMode === 'symbol') {
        ctx.fillStyle = '#FFFFFF'
      } else {
        ctx.fillStyle = color.hex
      }
      ctx.fillRect(x, y, cellSize, cellSize)

      if (renderMode === 'symbol' || renderMode === 'mixed') {
        const symbol = symbolMap!.get(cell.colorIndex) ?? '?'
        const fontSize = cellSize * 0.6
        ctx.font = `${fontSize}px monospace`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = renderMode === 'symbol' ? '#000000' : getTextColor(color.hex)
        ctx.fillText(symbol, x + cellSize / 2, y + cellSize / 2)
      }
    }
  }

  // Grid lines
  if (gridLines.showGrid) {
    // Regular grid lines
    if (gridLines.gridLineWidth > 0) {
      ctx.strokeStyle = gridLines.gridLineColor
      ctx.lineWidth = gridLines.gridLineWidth
      for (let row = 0; row <= grid.rows; row++) {
        ctx.beginPath()
        ctx.moveTo(0, row * cellSize)
        ctx.lineTo(grid.cols * cellSize, row * cellSize)
        ctx.stroke()
      }
      for (let col = 0; col <= grid.cols; col++) {
        ctx.beginPath()
        ctx.moveTo(col * cellSize, 0)
        ctx.lineTo(col * cellSize, grid.rows * cellSize)
        ctx.stroke()
      }
    }

    // Bold interval lines
    if (gridLines.boldGridInterval > 0) {
      ctx.strokeStyle = gridLines.boldGridColor
      ctx.lineWidth = gridLines.boldGridWidth
      for (let row = 0; row <= grid.rows; row += gridLines.boldGridInterval) {
        ctx.beginPath()
        ctx.moveTo(0, row * cellSize)
        ctx.lineTo(grid.cols * cellSize, row * cellSize)
        ctx.stroke()
      }
      for (let col = 0; col <= grid.cols; col += gridLines.boldGridInterval) {
        ctx.beginPath()
        ctx.moveTo(col * cellSize, 0)
        ctx.lineTo(col * cellSize, grid.rows * cellSize)
        ctx.stroke()
      }
    }
  }

  return canvas
}

export async function exportPNG(
  grid: BeadGrid,
  gridLines: GridLineSettings,
  cellSize: number,
): Promise<Blob> {
  const canvas = renderGridToCanvas(grid, 'color', cellSize, gridLines, 2)
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob)
      else reject(new Error('Canvas toBlob failed'))
    }, 'image/png')
  })
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

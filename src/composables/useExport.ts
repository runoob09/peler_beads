import type { BeadGrid, PaletteColor, RenderMode } from '../types'
import { embedInPng } from '../utils/embedMetadata'

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
  showLabels = false,
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
      if (cell.colorIndex === null) continue
      const color = grid.palette[cell.colorIndex]
      const x = col * cellSize
      const y = row * cellSize

      if (renderMode === 'symbol') {
        ctx.fillStyle = '#FFFFFF'
      } else {
        ctx.fillStyle = color.hex
      }
      ctx.fillRect(x, y, cellSize, cellSize)

      // Render color label inside cell
      if (showLabels) {
        const label = getColorLabel(color)
        const fontSize = Math.max(6, cellSize * 0.35)
        ctx.font = `bold ${fontSize}px monospace`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = getTextColor(color.hex)
        ctx.fillText(label, x + cellSize / 2, y + cellSize / 2)
      }

      if (renderMode === 'symbol' || renderMode === 'mixed') {
        const symbol = symbolMap!.get(cell.colorIndex!) ?? '?'
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

function getColorLabel(color: PaletteColor): string {
  // Extract short code from name (e.g., "A01" from "A01 白色", or just use name)
  const parts = color.name.split(/[\s_]+/)
  return parts[0] ?? color.hex
}

export function countColorUsage(grid: BeadGrid): Map<number, number> {
  const counts = new Map<number, number>()
  for (const row of grid.cells) {
    for (const cell of row) {
      if (cell.colorIndex === null) continue
      counts.set(cell.colorIndex, (counts.get(cell.colorIndex) ?? 0) + 1)
    }
  }
  return counts
}

export function renderExportCanvas(
  grid: BeadGrid,
  cellSize: number,
  gridLines: GridLineSettings,
  scale = 2,
): HTMLCanvasElement {
  const MARGIN = cellSize // space for column headers and row labels
  const gridW = grid.cols * cellSize
  const gridH = grid.rows * cellSize
  const canvasW = MARGIN + gridW

  // Calculate legend dimensions
  const counts = countColorUsage(grid)
  const sortedColors = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([idx, count]) => ({ paletteIndex: idx, color: grid.palette[idx], count }))

  const legendItemH = Math.max(14, cellSize * 0.7)
  const legendCols = Math.max(1, Math.floor(gridW / (cellSize * 5)))
  const legendRows = Math.ceil(sortedColors.length / legendCols)
  const legendH = legendRows * (legendItemH + 2) + 30

  const canvasH = MARGIN + gridH + legendH

  const canvas = document.createElement('canvas')
  canvas.width = canvasW * scale
  canvas.height = canvasH * scale
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  ctx.scale(scale, scale)

  // Background
  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, canvasW, canvasH)

  // --- Column headers ---
  ctx.fillStyle = '#333333'
  ctx.font = `bold ${Math.max(6, cellSize * 0.4)}px monospace`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (let col = 0; col < grid.cols; col++) {
    const x = MARGIN + col * cellSize + cellSize / 2
    ctx.fillText(String(col + 1), x, MARGIN / 2)
  }

  // --- Row headers ---
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'
  for (let row = 0; row < grid.rows; row++) {
    const y = MARGIN + row * cellSize + cellSize / 2
    ctx.fillText(String(row + 1), MARGIN - 4, y)
  }

  // --- Header border lines ---
  ctx.strokeStyle = '#333333'
  ctx.lineWidth = 1
  // Top-left corner
  ctx.strokeRect(0, 0, MARGIN, MARGIN)
  // Vertical separator
  ctx.beginPath()
  ctx.moveTo(MARGIN, 0)
  ctx.lineTo(MARGIN, MARGIN + gridH)
  ctx.stroke()
  // Horizontal separator
  ctx.beginPath()
  ctx.moveTo(0, MARGIN)
  ctx.lineTo(MARGIN + gridW, MARGIN)
  ctx.stroke()

  // --- Grid cells with color labels ---
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      const cell = grid.cells[row][col]
      if (cell.colorIndex === null) continue
      const color = grid.palette[cell.colorIndex]
      const x = MARGIN + col * cellSize
      const y = MARGIN + row * cellSize

      ctx.fillStyle = color.hex
      ctx.fillRect(x, y, cellSize, cellSize)

      // Color label inside cell
      const label = getColorLabel(color)
      const fontSize = Math.max(5, cellSize * 0.35)
      ctx.font = `bold ${fontSize}px monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = getTextColor(color.hex)
      ctx.fillText(label, x + cellSize / 2, y + cellSize / 2)
    }
  }

  // --- Grid lines ---
  if (gridLines.showGrid && gridLines.gridLineWidth > 0) {
    ctx.strokeStyle = gridLines.gridLineColor
    ctx.lineWidth = gridLines.gridLineWidth
    for (let row = 0; row <= grid.rows; row++) {
      ctx.beginPath()
      ctx.moveTo(MARGIN, MARGIN + row * cellSize)
      ctx.lineTo(MARGIN + gridW, MARGIN + row * cellSize)
      ctx.stroke()
    }
    for (let col = 0; col <= grid.cols; col++) {
      ctx.beginPath()
      ctx.moveTo(MARGIN + col * cellSize, MARGIN)
      ctx.lineTo(MARGIN + col * cellSize, MARGIN + gridH)
      ctx.stroke()
    }
  }

  if (gridLines.boldGridInterval > 0) {
    ctx.strokeStyle = gridLines.boldGridColor
    ctx.lineWidth = gridLines.boldGridWidth
    for (let row = 0; row <= grid.rows; row += gridLines.boldGridInterval) {
      ctx.beginPath()
      ctx.moveTo(MARGIN, MARGIN + row * cellSize)
      ctx.lineTo(MARGIN + gridW, MARGIN + row * cellSize)
      ctx.stroke()
    }
    for (let col = 0; col <= grid.cols; col += gridLines.boldGridInterval) {
      ctx.beginPath()
      ctx.moveTo(MARGIN + col * cellSize, MARGIN)
      ctx.lineTo(MARGIN + col * cellSize, MARGIN + gridH)
      ctx.stroke()
    }
  }

  // --- Legend ---
  const legendY = MARGIN + gridH + 10
  ctx.fillStyle = '#333333'
  ctx.font = `bold ${Math.max(8, cellSize * 0.45)}px sans-serif`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText('颜色图例（按数量降序）', MARGIN, legendY)

  const legendStartY = legendY + 18
  const colWidth = Math.floor((canvasW - MARGIN) / legendCols)

  ctx.font = `${Math.max(7, cellSize * 0.35)}px sans-serif`
  for (let i = 0; i < sortedColors.length; i++) {
    const lCol = i % legendCols
    const lRow = Math.floor(i / legendCols)
    const item = sortedColors[i]
    const lx = MARGIN + lCol * colWidth
    const ly = legendStartY + lRow * (legendItemH + 2)

    // Color swatch
    const swatchSize = Math.min(legendItemH - 2, 10)
    ctx.fillStyle = item.color.hex
    ctx.fillRect(lx, ly, swatchSize, swatchSize)
    ctx.strokeStyle = '#999999'
    ctx.lineWidth = 0.5
    ctx.strokeRect(lx, ly, swatchSize, swatchSize)

    // Color label
    const label = getColorLabel(item.color)
    ctx.fillStyle = '#333333'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(`${label} ×${item.count}`, lx + swatchSize + 4, ly)
  }

  return canvas
}

export async function exportPNG(
  grid: BeadGrid,
  gridLines: GridLineSettings,
  cellSize: number,
  projectJson?: string,
  imageBytes?: Uint8Array,
): Promise<Blob> {
  const canvas = renderExportCanvas(grid, cellSize, gridLines, 2)
  const pngBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob)
      else reject(new Error('Canvas toBlob failed'))
    }, 'image/png')
  })

  if (projectJson) {
    return embedInPng(pngBlob, projectJson, imageBytes)
  }
  return pngBlob
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

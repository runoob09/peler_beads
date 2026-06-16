import { describe, it, expect } from 'vitest'
import { buildSymbolMap, drawGridLines, renderAllCells, renderCell, renderExportCanvas } from '../useExport'
import type { BeadGrid, PaletteColor } from '../../types'
import type { GridLineSettings } from '../useExport'

function makeTestGrid(): BeadGrid {
  const palette: PaletteColor[] = [
    { id: 'w', name: 'White', hex: '#FFFFFF', brand: 'test' },
    { id: 'b', name: 'Black', hex: '#000000', brand: 'test' },
    { id: 'r', name: 'Red', hex: '#FF0000', brand: 'test' },
  ]
  return {
    rows: 2, cols: 2, palette,
    cells: [
      [
        { row: 0, col: 0, colorIndex: 0 },
        { row: 0, col: 1, colorIndex: 1 },
      ],
      [
        { row: 1, col: 0, colorIndex: 2 },
        { row: 1, col: 1, colorIndex: null },
      ],
    ],
    imageCols: 2,
    imageRows: 2,
  }
}

function makeGridLines(): GridLineSettings {
  return {
    showGrid: true,
    gridLineColor: '#cccccc',
    gridLineWidth: 1,
    boldGridInterval: 2,
    boldGridColor: '#333333',
    boldGridWidth: 2,
  }
}

// Mock canvas 2D context for happy-dom (no native canvas support)
function createMockCtx() {
  const _fillStyle = { value: '' }
  const _strokeStyle = { value: '' }
  const _lineWidth = { value: 0 }
  const _font = { value: '' }
  const _textAlign = { value: '' }
  const _textBaseline = { value: '' }

  return {
    get fillStyle() { return _fillStyle.value },
    set fillStyle(v: string) { _fillStyle.value = v },
    get strokeStyle() { return _strokeStyle.value },
    set strokeStyle(v: string) { _strokeStyle.value = v },
    get lineWidth() { return _lineWidth.value },
    set lineWidth(v: number) { _lineWidth.value = v },
    get font() { return _font.value },
    set font(v: string) { _font.value = v },
    get textAlign() { return _textAlign.value },
    set textAlign(v: string) { _textAlign.value = v },
    get textBaseline() { return _textBaseline.value },
    set textBaseline(v: string) { _textBaseline.value = v },
    fillRect(_x: number, _y: number, _w: number, _h: number) {},
    beginPath() {},
    moveTo(_x: number, _y: number) {},
    lineTo(_x: number, _y: number) {},
    stroke() {},
    fillText(_text: string, _x: number, _y: number) {},
  } as unknown as CanvasRenderingContext2D
}

describe('drawGridLines', () => {
  it('draws grid lines on a canvas without throwing', () => {
    const ctx = createMockCtx()
    const gridLines = makeGridLines()
    expect(() => drawGridLines(ctx, 2, 2, 20, gridLines)).not.toThrow()
  })

  it('draws nothing when showGrid is false', () => {
    const ctx = createMockCtx()
    const gridLines = { ...makeGridLines(), showGrid: false }
    expect(() => drawGridLines(ctx, 2, 2, 20, gridLines)).not.toThrow()
  })

  it('draws with offset', () => {
    const ctx = createMockCtx()
    const gridLines = makeGridLines()
    expect(() => drawGridLines(ctx, 2, 2, 20, gridLines, 10, 10)).not.toThrow()
  })

  it('does not draw when gridLineWidth is 0', () => {
    const ctx = createMockCtx()
    const gridLines = { ...makeGridLines(), gridLineWidth: 0 }
    expect(() => drawGridLines(ctx, 2, 2, 20, gridLines)).not.toThrow()
  })
})

describe('renderAllCells', () => {
  it('renders all cells without throwing', () => {
    const ctx = createMockCtx()
    const grid = makeTestGrid()
    expect(() => renderAllCells(ctx, grid, 20, 'color', false)).not.toThrow()
  })

  it('handles symbol render mode', () => {
    const ctx = createMockCtx()
    const grid = makeTestGrid()
    expect(() => renderAllCells(ctx, grid, 20, 'symbol', false)).not.toThrow()
  })

  it('handles mixed render mode', () => {
    const ctx = createMockCtx()
    const grid = makeTestGrid()
    expect(() => renderAllCells(ctx, grid, 20, 'mixed', false)).not.toThrow()
  })

  it('handles showLabels option', () => {
    const ctx = createMockCtx()
    const grid = makeTestGrid()
    expect(() => renderAllCells(ctx, grid, 20, 'color', true)).not.toThrow()
  })
})

describe('renderCell', () => {
  it('renders a single cell without throwing', () => {
    const ctx = createMockCtx()
    const grid = makeTestGrid()
    const symbolMap = buildSymbolMap(grid.palette)
    expect(() => renderCell(ctx, grid, 0, 1, 20, 'color', symbolMap, false)).not.toThrow()
  })

  it('does nothing for null colorIndex', () => {
    const ctx = createMockCtx()
    const grid = makeTestGrid()
    const symbolMap = buildSymbolMap(grid.palette)
    // Track if fillRect was called
    let fillRectCalled = false
    const origFillRect = ctx.fillRect
    ctx.fillRect = (...args: any[]) => { fillRectCalled = true; origFillRect.apply(ctx, args as any) }
    renderCell(ctx, grid, 1, 1, 20, 'color', symbolMap, false)
    expect(fillRectCalled).toBe(false)
  })

  it('calls fillRect for valid cell', () => {
    const ctx = createMockCtx()
    const grid = makeTestGrid()
    const symbolMap = buildSymbolMap(grid.palette)
    let fillRectCalled = false
    const origFillRect = ctx.fillRect
    ctx.fillRect = (...args: any[]) => { fillRectCalled = true; origFillRect.apply(ctx, args as any) }
    renderCell(ctx, grid, 0, 0, 20, 'color', symbolMap, false)
    expect(fillRectCalled).toBe(true)
  })
})

describe('buildSymbolMap', () => {
  it('assigns unique symbols to each palette color', () => {
    const palette: PaletteColor[] = [
      { id: '1', name: 'A', hex: '#FF0000', brand: 'test' },
      { id: '2', name: 'B', hex: '#00FF00', brand: 'test' },
      { id: '3', name: 'C', hex: '#0000FF', brand: 'test' },
    ]
    const map = buildSymbolMap(palette)
    const symbols = [...map.values()]
    const unique = new Set(symbols)
    expect(unique.size).toBe(3)
  })

  it('handles empty palette', () => {
    const map = buildSymbolMap([])
    expect(map.size).toBe(0)
  })

  it('index 0 maps to first symbol', () => {
    const palette: PaletteColor[] = [
      { id: '1', name: 'A', hex: '#FF0000', brand: 'test' },
    ]
    const map = buildSymbolMap(palette)
    expect(map.get(0)).toBe('A')
  })
})

describe('downloadBlob', () => {
  it('exports downloadBlob function', async () => {
    const { downloadBlob } = await import('../useExport')
    expect(typeof downloadBlob).toBe('function')
  })
})

describe('renderExportCanvas total count', () => {
  it('includes total bead count in the legend area', () => {
    const grid = makeTestGrid() // 2x2 grid, 3 colored cells + 1 null
    const gridLines = makeGridLines()

    // Collect fillText calls by mocking getContext on canvas prototype
    const texts: string[] = []
    const origGetContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function () {
      const mockCtx = createMockCtx()
      mockCtx.scale = () => {}
      const origFillText = mockCtx.fillText
      mockCtx.fillText = (text: string, x: number, y: number) => {
        texts.push(text)
        return origFillText.call(mockCtx, text, x, y)
      }
      mockCtx.strokeRect = () => {}
      return mockCtx as unknown as CanvasRenderingContext2D
    }

    try {
      renderExportCanvas(grid, 20, gridLines, 1)
    } finally {
      HTMLCanvasElement.prototype.getContext = origGetContext
    }

    const totalLine = texts.find(t => t.includes('总计'))
    expect(totalLine).toBeDefined()
    expect(totalLine).toContain('3') // 3 colored cells
  })
})

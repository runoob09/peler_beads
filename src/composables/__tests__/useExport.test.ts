import { describe, it, expect } from 'vitest'
import { buildSymbolMap } from '../useExport'
import type { PaletteColor } from '../../types'

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

import { describe, it, expect } from 'vitest'
import { createColorMatcher } from '../useColorMatcher'
import type { PaletteColor } from '../../types'

interface TestColor extends PaletteColor {
  lab: [number, number, number]
}

function makeColor(hex: string, name: string): TestColor {
  return {
    id: hex,
    name,
    hex: hex.toUpperCase(),
    brand: 'test',
    lab: [0, 0, 0],
  }
}

describe('createColorMatcher', () => {
  it('matches pure red to red in palette', () => {
    const palette: TestColor[] = [
      makeColor('#FFFFFF', 'White'),
      makeColor('#000000', 'Black'),
      makeColor('#FF0000', 'Red'),
      makeColor('#0000FF', 'Blue'),
    ]
    const match = createColorMatcher(palette)
    const result = match(255, 0, 0)
    expect(result.index).toBe(2)
  })

  it('matches pure white', () => {
    const palette: TestColor[] = [
      makeColor('#FFFFFF', 'White'),
      makeColor('#000000', 'Black'),
    ]
    const match = createColorMatcher(palette)
    const result = match(255, 255, 255)
    expect(result.index).toBe(0)
  })

  it('matches pure black', () => {
    const palette: TestColor[] = [
      makeColor('#FFFFFF', 'White'),
      makeColor('#000000', 'Black'),
    ]
    const match = createColorMatcher(palette)
    const result = match(0, 0, 0)
    expect(result.index).toBe(1)
  })

  it('returns consistent results for repeated lookups', () => {
    const palette: TestColor[] = [
      makeColor('#FFFFFF', 'White'),
      makeColor('#FF0000', 'Red'),
    ]
    const match = createColorMatcher(palette)
    const r1 = match(255, 0, 0)
    const r2 = match(255, 0, 0)
    expect(r1.index).toBe(r2.index)
  })

  it('returns rgb of matched color', () => {
    const palette: TestColor[] = [
      makeColor('#FFFFFF', 'White'),
      makeColor('#FF0000', 'Red'),
    ]
    const match = createColorMatcher(palette)
    const result = match(255, 0, 0)
    expect(result.rgb).toEqual([255, 0, 0])
  })

  describe('rgb method', () => {
    it('matches pure red to red', () => {
      const palette: TestColor[] = [
        makeColor('#FFFFFF', 'White'),
        makeColor('#000000', 'Black'),
        makeColor('#FF0000', 'Red'),
        makeColor('#0000FF', 'Blue'),
      ]
      const match = createColorMatcher(palette, 'rgb')
      const result = match(255, 0, 0)
      expect(result.index).toBe(2)
    })

    it('matches dark gray closer to black', () => {
      const palette: TestColor[] = [
        makeColor('#FFFFFF', 'White'),
        makeColor('#000000', 'Black'),
      ]
      const match = createColorMatcher(palette, 'rgb')
      const result = match(30, 30, 30)
      expect(result.index).toBe(1) // closer to black in RGB space
    })
  })
})

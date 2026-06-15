import type { PaletteColor, ColorMatchScheme } from '../types'
import { hexToRgb, rgbToLab, deltaE, rgbDistance, weightedRgbDistance, type LAB, type RGB } from '../utils/colorSpace'

interface PaletteEntry {
  index: number
  hex: string
  lab: LAB
  rgb: RGB
}

export interface MatchResult {
  index: number
  rgb: RGB
}

export type MatchFunction = (r: number, g: number, b: number) => MatchResult

function quantizeChannel(v: number): number {
  return Math.round(v / 8)
}

function makeCacheKey(r: number, g: number, b: number): string {
  return `${quantizeChannel(r)},${quantizeChannel(g)},${quantizeChannel(b)}`
}

export function createColorMatcher(
  palette: PaletteColor[],
  scheme: ColorMatchScheme = 'deltaE',
): MatchFunction {
  const entries: PaletteEntry[] = palette.map((c, i) => {
    const [r, g, b] = hexToRgb(c.hex)
    return {
      index: i,
      hex: c.hex,
      lab: rgbToLab(r, g, b),
      rgb: [r, g, b],
    }
  })

  const cache = new Map<string, MatchResult>()

  if (scheme === 'rgb') {
    return (r: number, g: number, b: number): MatchResult => {
      const key = makeCacheKey(r, g, b)
      const cached = cache.get(key)
      if (cached) return cached

      const target: RGB = [r, g, b]
      let bestIndex = 0
      let bestDist = Infinity

      for (let i = 0; i < entries.length; i++) {
        const d = rgbDistance(target, entries[i].rgb)
        if (d < bestDist) {
          bestDist = d
          bestIndex = i
        }
      }

      const result: MatchResult = { index: bestIndex, rgb: entries[bestIndex].rgb }
      cache.set(key, result)
      return result
    }
  }

  if (scheme === 'weightedRgb') {
    return (r: number, g: number, b: number): MatchResult => {
      const key = makeCacheKey(r, g, b)
      const cached = cache.get(key)
      if (cached) return cached

      const target: RGB = [r, g, b]
      let bestIndex = 0
      let bestDist = Infinity

      for (let i = 0; i < entries.length; i++) {
        const d = weightedRgbDistance(target, entries[i].rgb)
        if (d < bestDist) {
          bestDist = d
          bestIndex = i
        }
      }

      const result: MatchResult = { index: bestIndex, rgb: entries[bestIndex].rgb }
      cache.set(key, result)
      return result
    }
  }

  // default: deltaE
  return (r: number, g: number, b: number): MatchResult => {
    const key = makeCacheKey(r, g, b)
    const cached = cache.get(key)
    if (cached) return cached

    const lab = rgbToLab(r, g, b)
    let bestIndex = 0
    let bestDelta = Infinity

    for (let i = 0; i < entries.length; i++) {
      const d = deltaE(lab, entries[i].lab)
      if (d < bestDelta) {
        bestDelta = d
        bestIndex = i
      }
    }

    const result: MatchResult = { index: bestIndex, rgb: entries[bestIndex].rgb }
    cache.set(key, result)
    return result
  }
}

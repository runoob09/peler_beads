import type { BeadCell } from '../types'

export type ColorMatchFn = (r: number, g: number, b: number) => { index: number; rgb: [number, number, number] }

interface DitherEntry {
  dr: number
  dc: number
  weight: number
}

const FS_DISTRIBUTION: DitherEntry[] = [
  { dr: 0, dc: 1, weight: 7 },
  { dr: 1, dc: -1, weight: 3 },
  { dr: 1, dc: 0, weight: 5 },
  { dr: 1, dc: 1, weight: 1 },
]
const FS_DIVISOR = 16

const ATKINSON_DISTRIBUTION: DitherEntry[] = [
  { dr: 0, dc: 1, weight: 1 },
  { dr: 0, dc: 2, weight: 1 },
  { dr: 1, dc: -1, weight: 1 },
  { dr: 1, dc: 0, weight: 1 },
  { dr: 1, dc: 1, weight: 1 },
  { dr: 2, dc: 0, weight: 1 },
]
const ATKINSON_DIVISOR = 8

function applyDither(
  imageData: ImageData,
  matchColor: ColorMatchFn,
  strength: number,
  distributions: DitherEntry[],
  divisor: number,
): BeadCell[][] {
  const { data, width, height } = imageData
  const errors = new Float32Array(width * height * 3)
  const result: BeadCell[][] = Array.from({ length: height }, () => [])
  const factor = strength / 100

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const idx = (row * width + col) * 4
      const errIdx = (row * width + col) * 3

      let r = Math.round(data[idx] + errors[errIdx] * factor)
      let g = Math.round(data[idx + 1] + errors[errIdx + 1] * factor)
      let b = Math.round(data[idx + 2] + errors[errIdx + 2] * factor)

      r = Math.max(0, Math.min(255, r))
      g = Math.max(0, Math.min(255, g))
      b = Math.max(0, Math.min(255, b))

      const match = matchColor(r, g, b)
      const [qr, qg, qb] = match.rgb

      const errR = r - qr
      const errG = g - qg
      const errB = b - qb

      for (const { dr, dc, weight } of distributions) {
        const nr = row + dr
        const nc = col + dc
        if (nr >= 0 && nr < height && nc >= 0 && nc < width) {
          const nErrIdx = (nr * width + nc) * 3
          errors[nErrIdx] += errR * (weight / divisor)
          errors[nErrIdx + 1] += errG * (weight / divisor)
          errors[nErrIdx + 2] += errB * (weight / divisor)
        }
      }

      result[row].push({ row, col, colorIndex: match.index })
    }
  }

  return result
}

export function floydSteinbergDither(
  imageData: ImageData,
  matchColor: ColorMatchFn,
  strength: number,
): BeadCell[][] {
  return applyDither(imageData, matchColor, strength, FS_DISTRIBUTION, FS_DIVISOR)
}

export function atkinsonDither(
  imageData: ImageData,
  matchColor: ColorMatchFn,
  strength: number,
): BeadCell[][] {
  return applyDither(imageData, matchColor, strength, ATKINSON_DISTRIBUTION, ATKINSON_DIVISOR)
}

export type LAB = [number, number, number] // [L, a, b]
export type RGB = [number, number, number] // [r, g, b]

export function hexToRgb(hex: string): RGB {
  const h = hex.replace('#', '')
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ]
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => {
    const clamped = Math.max(0, Math.min(255, Math.round(n)))
    return clamped.toString(16).padStart(2, '0').toUpperCase()
  }
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function srgbToLinear(c: number): number {
  const normalized = c / 255
  return normalized <= 0.04045
    ? normalized / 12.92
    : Math.pow((normalized + 0.055) / 1.055, 2.4)
}

// D65 illuminant reference white (normalized to Y=1 scale)
const REF_X = 0.95047
const REF_Y = 1.0
const REF_Z = 1.08883

export function rgbToLab(r: number, g: number, b: number): LAB {
  let rl = srgbToLinear(r)
  let gl = srgbToLinear(g)
  let bl = srgbToLinear(b)

  // RGB → XYZ
  let x = rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375
  let y = rl * 0.2126729 + gl * 0.7151522 + bl * 0.0721750
  let z = rl * 0.0193339 + gl * 0.1191920 + bl * 0.9503041

  x /= REF_X
  y /= REF_Y
  z /= REF_Z

  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)

  const fx = f(x)
  const fy = f(y)
  const fz = f(z)

  const L = 116 * fy - 16
  const a = 500 * (fx - fy)
  const bVal = 200 * (fy - fz)

  return [L, a, bVal]
}

// Euclidean distance in RGB space
export function rgbDistance(rgb1: RGB, rgb2: RGB): number {
  const dr = rgb1[0] - rgb2[0]
  const dg = rgb1[1] - rgb2[1]
  const db = rgb1[2] - rgb2[2]
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

// Weighted RGB distance (luminance perception weights)
export function weightedRgbDistance(rgb1: RGB, rgb2: RGB): number {
  const dr = (rgb1[0] - rgb2[0]) * 0.299
  const dg = (rgb1[1] - rgb2[1]) * 0.587
  const db = (rgb1[2] - rgb2[2]) * 0.114
  return Math.sqrt(dr * dr + dg * dg + db * db)
}

export function deltaE(lab1: LAB, lab2: LAB): number {
  const [L1, a1, b1] = lab1
  const [L2, a2, b2] = lab2
  const dL = L1 - L2
  const da = a1 - a2
  const db = b1 - b2
  return Math.sqrt(dL * dL + da * da + db * db)
}

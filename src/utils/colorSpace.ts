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

// CIEDE2000 — 目前最精确的色差公式，对明度/色度/色相分别修正
export function ciede2000(lab1: LAB, lab2: LAB): number {
  const [L1, a1, b1] = lab1
  const [L2, a2, b2] = lab2

  const C1 = Math.sqrt(a1 * a1 + b1 * b1)
  const C2 = Math.sqrt(a2 * a2 + b2 * b2)
  const Cbar = (C1 + C2) / 2

  const Cbar7 = Cbar ** 7
  const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + 25 ** 7)))

  const a1p = a1 * (1 + G)
  const a2p = a2 * (1 + G)

  const C1p = Math.sqrt(a1p * a1p + b1 * b1)
  const C2p = Math.sqrt(a2p * a2p + b2 * b2)

  const h1p = (Math.atan2(b1, a1p) * 180 / Math.PI + 360) % 360
  const h2p = (Math.atan2(b2, a2p) * 180 / Math.PI + 360) % 360

  const dLp = L2 - L1
  const dCp = C2p - C1p

  let dhp: number
  const hDiff = h2p - h1p
  if (C1p === 0 || C2p === 0) {
    dhp = 0
  } else if (Math.abs(hDiff) <= 180) {
    dhp = hDiff
  } else if (hDiff > 180) {
    dhp = hDiff - 360
  } else {
    dhp = hDiff + 360
  }

  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp * Math.PI / 180) / 2)

  const Lbar = (L1 + L2) / 2
  const CbarP = (C1p + C2p) / 2

  let hbarP: number
  if (C1p === 0 || C2p === 0) {
    hbarP = h1p + h2p
  } else if (Math.abs(h1p - h2p) <= 180) {
    hbarP = (h1p + h2p) / 2
  } else if (h1p + h2p >= 360) {
    hbarP = (h1p + h2p - 360) / 2
  } else {
    hbarP = (h1p + h2p + 360) / 2
  }

  const deg2rad = Math.PI / 180
  const T = 1
    - 0.17 * Math.cos((hbarP - 30) * deg2rad)
    + 0.24 * Math.cos(2 * hbarP * deg2rad)
    + 0.32 * Math.cos((3 * hbarP + 6) * deg2rad)
    - 0.20 * Math.cos((4 * hbarP - 63) * deg2rad)

  const dTheta = 30 * Math.exp(-(((hbarP - 275) / 25) ** 2))
  const RC = 2 * Math.sqrt(CbarP ** 7 / (CbarP ** 7 + 25 ** 7))
  const RT = -Math.sin(2 * dTheta * deg2rad) * RC

  const SL = 1 + (0.015 * (Lbar - 50) ** 2) / Math.sqrt(20 + (Lbar - 50) ** 2)
  const SC = 1 + 0.045 * CbarP
  const SH = 1 + 0.015 * CbarP * T

  const termL = dLp / SL
  const termC = dCp / SC
  const termH = dHp / SH

  return Math.sqrt(termL * termL + termC * termC + termH * termH + RT * termC * termH)
}

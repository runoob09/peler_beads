/**
 * PNG/PDF 项目元数据嵌入与提取
 *
 * PNG 方案：
 *   在 IHDR 之后、IDAT 之前插入两个辅助块：
 *     1. tEXt 块 — keyword="perler-beads"，text = 项目 JSON
 *     2. beAd 块 — 自定义私有块，原始图片二进制（可选）
 *   tEXt 和 beAd 均为辅助块（ancillary），所有图像渲染器忽略但保留。
 *
 * PDF 方案：
 *   利用 PDF 原生机制：
 *     1. /Info Keywords — 存储项目 JSON
 *     2. /EmbeddedFiles — 原始图片作为附件嵌入（可选）
 */

const PNG_SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])
const IHDR_LENGTH = 13 // IHDR data is always 13 bytes
const IHDR_TOTAL = 4 + 4 + IHDR_LENGTH + 4 // length + type + data + crc = 25

// ─── CRC32 ───────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
    }
    table[i] = c
  }
  return table
})()

function crc32(data: Uint8Array): number {
  let c = 0xffffffff
  for (let i = 0; i < data.length; i++) {
    c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

// ─── Binary helpers ──────────────────────────────────────────────

function writeUint32BE(value: number): Uint8Array {
  const buf = new Uint8Array(4)
  buf[0] = (value >>> 24) & 0xff
  buf[1] = (value >>> 16) & 0xff
  buf[2] = (value >>> 8) & 0xff
  buf[3] = value & 0xff
  return buf
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return (
    ((bytes[offset] << 24) >>> 0) +
    (bytes[offset + 1] << 16) +
    (bytes[offset + 2] << 8) +
    bytes[offset + 3]
  )
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const totalLen = arrays.reduce((sum, a) => sum + a.length, 0)
  const result = new Uint8Array(totalLen)
  let offset = 0
  for (const a of arrays) {
    result.set(a, offset)
    offset += a.length
  }
  return result
}

// ─── PNG chunk building ──────────────────────────────────────────

/** 构建 PNG chunk：length(4) + type(4) + data(N) + crc(4) */
function buildChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type)
  const lengthBytes = writeUint32BE(data.length)
  const typeAndData = concatBytes(typeBytes, data)
  const crcBytes = writeUint32BE(crc32(typeAndData))
  return concatBytes(lengthBytes, typeBytes, data, crcBytes)
}

function buildTextChunk(keyword: string, text: string): Uint8Array {
  const kw = new TextEncoder().encode(keyword)
  const zero = new Uint8Array([0])
  const textBytes = new TextEncoder().encode(text)
  return buildChunk('tEXt', concatBytes(kw, zero, textBytes))
}

// ─── PNG chunk parsing ───────────────────────────────────────────

interface PngChunkInfo {
  type: string
  dataOffset: number
  dataLength: number
  chunkStart: number // offset to length field
  totalLength: number // length + type + data + crc
}

function parsePngChunks(bytes: Uint8Array): PngChunkInfo[] {
  const chunks: PngChunkInfo[] = []
  let offset = PNG_SIGNATURE.length

  while (offset < bytes.length) {
    if (offset + 8 > bytes.length) break
    const chunkStart = offset
    const length = readUint32BE(bytes, offset)
    offset += 4
    const type = new TextDecoder().decode(bytes.slice(offset, offset + 4))
    offset += 4
    const dataOffset = offset
    offset += length + 4 // data + crc

    chunks.push({ type, dataOffset, dataLength: length, chunkStart, totalLength: offset - chunkStart })
  }

  return chunks
}

// ─── Public API: PNG ─────────────────────────────────────────────

/**
 * 将项目 JSON 和原始图片嵌入 PNG blob 中。
 * 返回新的 blob 与原图视觉完全一致。
 */
export async function embedInPng(
  pngBlob: Blob,
  projectJson: string,
  imageBytes?: Uint8Array,
): Promise<Blob> {
  const pngBytes = new Uint8Array(await pngBlob.arrayBuffer())

  // Verify PNG signature
  for (let i = 0; i < PNG_SIGNATURE.length; i++) {
    if (pngBytes[i] !== PNG_SIGNATURE[i]) {
      throw new Error('Invalid PNG signature')
    }
  }

  const sig = pngBytes.slice(0, PNG_SIGNATURE.length)
  const afterIHDR = PNG_SIGNATURE.length + IHDR_TOTAL // always 33
  const remainder = pngBytes.slice(afterIHDR)

  const chunks: Uint8Array[] = []

  // tEXt chunk: project JSON
  chunks.push(buildTextChunk('perler-beads', projectJson))

  // beAd chunk: original image binary (private ancillary)
  if (imageBytes && imageBytes.length > 0) {
    chunks.push(buildChunk('beAd', imageBytes))
  }

  const result = concatBytes(sig, pngBytes.slice(PNG_SIGNATURE.length, afterIHDR), ...chunks, remainder)
  return new Blob([result as unknown as BlobPart], { type: 'image/png' })
}

export interface EmbeddedProject {
  projectJson: string | null
  imageBytes: Uint8Array | null
}

/**
 * 从 PNG 字节中提取嵌入的项目数据。
 */
export function extractFromPng(pngBytes: Uint8Array): EmbeddedProject {
  // Verify signature
  for (let i = 0; i < PNG_SIGNATURE.length; i++) {
    if (pngBytes[i] !== PNG_SIGNATURE[i]) {
      return { projectJson: null, imageBytes: null }
    }
  }

  let projectJson: string | null = null
  let imageBytes: Uint8Array | null = null

  const chunks = parsePngChunks(pngBytes)
  for (const chunk of chunks) {
    if (chunk.type === 'tEXt') {
      // tEXt data: keyword\0text
      const data = pngBytes.slice(chunk.dataOffset, chunk.dataOffset + chunk.dataLength)
      const nullIdx = data.indexOf(0)
      if (nullIdx === -1) continue
      const keyword = new TextDecoder().decode(data.slice(0, nullIdx))
      if (keyword === 'perler-beads') {
        projectJson = new TextDecoder().decode(data.slice(nullIdx + 1))
      }
    } else if (chunk.type === 'beAd') {
      imageBytes = pngBytes.slice(chunk.dataOffset, chunk.dataOffset + chunk.dataLength)
    }
  }

  return { projectJson, imageBytes }
}

// ─── Public API: PDF ─────────────────────────────────────────────

/**
 * 将项目 JSON 和原始图片嵌入已生成的 PDF 字节中。
 * pdf-lib 在浏览器端可用，通过动态 import 避免服务端依赖。
 */
export async function embedInPdf(
  pdfBytes: Uint8Array,
  projectJson: string,
  imageBytes?: Uint8Array,
  imageType?: string,
): Promise<Uint8Array> {
  const { PDFDocument } = await import('pdf-lib')
  const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true })

  doc.setKeywords([projectJson])

  if (imageBytes && imageBytes.length > 0) {
    await doc.attach(imageBytes, 'original-image', {
      mimeType: imageType || 'application/octet-stream',
    })
  }

  return new Uint8Array(await doc.save())
}

/**
 * 从 PDF 字节中提取嵌入的项目数据。
 */
export async function extractFromPdf(pdfBytes: Uint8Array): Promise<EmbeddedProject> {
  const { PDFDocument } = await import('pdf-lib')
  const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true })

  const projectJson = doc.getKeywords() || null

  // PDF 嵌入文件提取需要遍历 Catalog/Names/EmbeddedFiles 树，
  // pdf-lib 未暴露该公共 API，对 PDF 暂仅提取项目 JSON。
  const imageBytes: Uint8Array | null = null

  return { projectJson, imageBytes }
}

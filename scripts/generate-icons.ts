import fs from 'node:fs'
import path from 'node:path'
import { deflateSync, crc32 } from 'node:zlib'

// We will generate pure uncompressed/deflated valid PNG files for 192x192 and 512x512
// Colors:
// Background: #0F766E -> [15, 118, 110]
// Corner border subtle: #134e4a
// Accent layer: #F59E0B -> [245, 158, 11]
// Bright teal layer: #2DD4BF -> [45, 212, 191]
// White layer: #FFFFFF -> [255, 255, 255]

function createPng(
  width: number,
  height: number,
  drawer: (x: number, y: number) => [number, number, number, number],
): Buffer {
  // RGBA buffer with filter byte per row (0 = None)
  const rowSize = 1 + width * 4
  const rawData = Buffer.alloc(rowSize * height)

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize
    rawData[rowOffset] = 0 // Filter type None
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = drawer(x, y)
      const pxOffset = rowOffset + 1 + x * 4
      rawData[pxOffset] = r
      rawData[pxOffset + 1] = g
      rawData[pxOffset + 2] = b
      rawData[pxOffset + 3] = a
    }
  }

  const compressed = deflateSync(rawData)

  // Build PNG chunks
  // Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])

  // IHDR chunk
  const ihdrData = Buffer.alloc(13)
  ihdrData.writeUInt32BE(width, 0)
  ihdrData.writeUInt32BE(height, 4)
  ihdrData[8] = 8 // bit depth
  ihdrData[9] = 6 // color type RGBA
  ihdrData[10] = 0 // compression
  ihdrData[11] = 0 // filter
  ihdrData[12] = 0 // interlace
  const ihdrChunk = makeChunk('IHDR', ihdrData)

  // IDAT chunk
  const idatChunk = makeChunk('IDAT', compressed)

  // IEND chunk
  const iendChunk = makeChunk('IEND', Buffer.alloc(0))

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk])
}

function makeChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcInput = Buffer.concat([typeBuf, data])
  const crcVal = crc32(crcInput)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crcVal >>> 0, 0)
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

function drawIconPixel(x: number, y: number, size: number): [number, number, number, number] {
  // Normalized coords 0..1
  const nx = x / size
  const ny = y / size

  // Rounded rectangle check (radius 0.22)
  const r = 0.22
  let inSquircle = true
  const dx = Math.max(0, Math.abs(nx - 0.5) - (0.5 - r))
  const dy = Math.max(0, Math.abs(ny - 0.5) - (0.5 - r))
  if (dx * dx + dy * dy > r * r) {
    inSquircle = false
  }
  if (!inSquircle) {
    return [0, 0, 0, 0] // Transparent outside rounded squircle
  }

  // Base background teal gradient
  // Top-left: [15, 118, 110] (#0F766E), Bottom-right: [13, 75, 71] (#0D4B47)
  const gradT = (nx + ny) / 2
  let bgR = Math.round(15 * (1 - gradT * 0.4))
  let bgG = Math.round(118 * (1 - gradT * 0.35))
  let bgB = Math.round(110 * (1 - gradT * 0.35))

  // Radial glow in upper center
  const gdx = nx - 0.5
  const gdy = ny - 0.35
  const gdist = Math.sqrt(gdx * gdx + gdy * gdy)
  if (gdist < 0.35) {
    const glow = (1 - gdist / 0.35) * 0.25
    bgR = Math.min(255, Math.round(bgR + 20 * glow))
    bgG = Math.min(255, Math.round(bgG + 180 * glow))
    bgB = Math.min(255, Math.round(bgB + 160 * glow))
  }

  // Draw layers diamond shape (rhombus)
  // Center is (0.5, 0.40)
  // Layer 1 (Top diamond, White to Mint)
  // Top vertex: (0.5, 0.22), Right: (0.75, 0.34), Bottom: (0.5, 0.46), Left: (0.25, 0.34)
  const cx = 0.5
  const cy1 = 0.34
  const relX = Math.abs(nx - cx) / 0.25
  const relY1 = Math.abs(ny - cy1) / 0.12
  if (relX + relY1 <= 1.0 && ny <= cy1 + 0.12 * (1 - relX)) {
    // Top surface
    const light = 1 - ((nx - 0.25) / 0.5) * 0.2
    return [Math.round(255 * light), Math.round(255 * light), Math.round(250 * light), 255]
  }

  // Layer 2 (Middle rim, Teal 2DD4BF)
  // Between cy1 + 0.05 and cy1 + 0.14
  const cy2 = cy1 + 0.08
  const relY2 = (ny - cy2) / 0.12
  if (relX <= 1.0 && ny > cy1 && ny <= cy2 + 0.05) {
    const diamondDist = relX + Math.abs(ny - cy2) / 0.12
    if (diamondDist <= 1.08 && ny > cy1 + 0.02) {
      return [45, 212, 191, 255]
    }
  }

  // Layer 3 (Bottom rim, Amber / Golden F59E0B)
  const cy3 = cy1 + 0.16
  if (relX <= 1.0 && ny > cy2 && ny <= cy3 + 0.06) {
    const diamondDist3 = relX + Math.abs(ny - cy3) / 0.12
    if (diamondDist3 <= 1.1 && ny > cy2 + 0.02) {
      return [245, 158, 11, 255]
    }
  }

  // Bold "N" in the bottom half:
  // let's draw a clean stylized letter 'N' or letter blocks if size allows
  // N bounds: x in [0.38, 0.62], y in [0.65, 0.82]
  const nLeft = 0.38
  const nRight = 0.62
  const nTop = 0.66
  const nBottom = 0.84
  const barW = 0.05

  if (nx >= nLeft && nx <= nRight && ny >= nTop && ny <= nBottom) {
    // Left vertical bar
    if (nx <= nLeft + barW) {
      return [255, 255, 255, 255]
    }
    // Right vertical bar
    if (nx >= nRight - barW) {
      return [255, 255, 255, 255]
    }
    // Diagonal
    const diagX = nLeft + ((ny - nTop) / (nBottom - nTop)) * (nRight - nLeft - barW)
    if (nx >= diagX && nx <= diagX + barW) {
      return [255, 255, 255, 255]
    }
  }

  return [bgR, bgG, bgB, 255]
}

const p192 = createPng(192, 192, (x, y) => drawIconPixel(x, y, 192))
fs.writeFileSync(path.resolve('public/icon-192.png'), p192)

const p512 = createPng(512, 512, (x, y) => drawIconPixel(x, y, 512))
fs.writeFileSync(path.resolve('public/icon-512.png'), p512)

// Also create apple-touch-icon (180x180)
const p180 = createPng(180, 180, (x, y) => drawIconPixel(x, y, 180))
fs.writeFileSync(path.resolve('public/apple-touch-icon.png'), p180)

console.log(
  'Successfully generated public/icon-192.png, public/icon-512.png, public/apple-touch-icon.png',
)

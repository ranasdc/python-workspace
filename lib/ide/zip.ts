/**
 * A tiny ZIP writer, used to hand a whole project over in one download.
 *
 * Browsers cancel all but the first of several downloads fired together, so an
 * HTML page and the stylesheet it links have to arrive as a single file.
 * Entries are stored uncompressed: these are a few kilobytes of source each,
 * where deflate would save almost nothing and cost a whole compression
 * implementation in the bundle.
 */

export type ZipEntry = {
  name: string
  content: string
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let crc = i
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
    }
    table[i] = crc >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function u16(value: number) {
  return new Uint8Array([value & 0xff, (value >>> 8) & 0xff])
}

function u32(value: number) {
  return new Uint8Array([
    value & 0xff,
    (value >>> 8) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 24) & 0xff,
  ])
}

/** ZIP timestamps use the MS-DOS format, whose epoch is 1980 and whose
 *  seconds field has two-second resolution. */
function dosTimestamp(when: Date) {
  const year = Math.max(when.getFullYear(), 1980)
  return {
    time: u16((when.getHours() << 11) | (when.getMinutes() << 5) | (when.getSeconds() >> 1)),
    date: u16(((year - 1980) << 9) | ((when.getMonth() + 1) << 5) | when.getDate()),
  }
}

function byteLength(parts: Uint8Array[]) {
  return parts.reduce((total, part) => total + part.length, 0)
}

/** Bundle text files into an uncompressed ZIP archive. */
export function createZip(entries: ZipEntry[], when = new Date()): Blob {
  const encoder = new TextEncoder()
  const { time, date } = dosTimestamp(when)
  // Bit 11 declares the file names as UTF-8 rather than legacy code page 437.
  const flags = u16(0x0800)
  const localParts: Uint8Array[] = []
  const centralParts: Uint8Array[] = []
  let localOffset = 0

  for (const entry of entries) {
    const name = encoder.encode(entry.name)
    const data = encoder.encode(entry.content)
    const crc = u32(crc32(data))
    const size = u32(data.length)

    const local = [
      u32(0x04034b50), // local file header signature
      u16(20), // version needed to extract
      flags,
      u16(0), // method: stored
      time,
      date,
      crc,
      size, // compressed size (same, since stored)
      size, // uncompressed size
      u16(name.length),
      u16(0), // extra field length
      name,
      data,
    ]
    localParts.push(...local)

    centralParts.push(
      u32(0x02014b50), // central directory header signature
      u16(20), // version made by
      u16(20), // version needed to extract
      flags,
      u16(0), // method: stored
      time,
      date,
      crc,
      size,
      size,
      u16(name.length),
      u16(0), // extra field length
      u16(0), // comment length
      u16(0), // disk number start
      u16(0), // internal attributes
      u32(0), // external attributes
      u32(localOffset),
      name,
    )

    localOffset += byteLength(local)
  }

  const centralSize = byteLength(centralParts)
  const end = [
    u32(0x06054b50), // end of central directory signature
    u16(0), // this disk
    u16(0), // disk holding the central directory
    u16(entries.length),
    u16(entries.length),
    u32(centralSize),
    u32(localOffset),
    u16(0), // archive comment length
  ]

  return new Blob([...localParts, ...centralParts, ...end], { type: "application/zip" })
}

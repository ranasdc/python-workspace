/**
 * Converts the generated avatar PNGs in .avatar-src/ into small square WebP
 * files in public/avatars/.
 *
 * `next.config.mjs` sets `images.unoptimized`, so nothing resizes these at
 * request time: whatever lands in public/ is exactly what a pupil downloads.
 * The picker shows all 50 at once, so the source PNGs (~950KB each, ~47MB)
 * would be unusable on a school connection.
 *
 * Run with: node scripts/optimise-avatars.mjs
 */
import { readdirSync, mkdirSync, statSync } from "node:fs"
import { join } from "node:path"
import sharp from "sharp"

const SRC = ".avatar-src"
const OUT = "public/avatars"

// 160px covers every use: the largest render is the 64px profile card, so this
// stays crisp on 2x displays with headroom to spare.
const SIZE = 160

mkdirSync(OUT, { recursive: true })

const files = readdirSync(SRC).filter((f) => f.endsWith(".png"))
let totalIn = 0
let totalOut = 0

for (const file of files) {
  const from = join(SRC, file)
  const to = join(OUT, file.replace(/\.png$/, ".webp"))

  await sharp(from)
    .resize(SIZE, SIZE, { fit: "cover", position: "centre" })
    .webp({ quality: 80, effort: 6 })
    .toFile(to)

  totalIn += statSync(from).size
  totalOut += statSync(to).size
}

const mb = (n) => (n / 1024 / 1024).toFixed(2) + "MB"
console.log(`${files.length} avatars: ${mb(totalIn)} -> ${mb(totalOut)}`)
console.log(`average ${(totalOut / files.length / 1024).toFixed(1)}KB each`)

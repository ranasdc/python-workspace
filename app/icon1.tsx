import { ImageResponse } from "next/og"
import { LOGO_DATA_URI } from "@/lib/site"

// PNG fallback for browsers and crawlers that don't use the SVG favicon.
export const size = { width: 96, height: 96 }
export const contentType = "image/png"

export default function PngIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex" }}>
        <img src={LOGO_DATA_URI} width={96} height={96} alt="" />
      </div>
    ),
    size,
  )
}

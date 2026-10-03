import { ImageResponse } from "next/og"
import { LOGO_DATA_URI } from "@/lib/site"

export const size = { width: 180, height: 180 }
export const contentType = "image/png"

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1b2233",
        }}
      >
        {/* Full-bleed so iOS's own rounded mask frames the tile cleanly. */}
        <img src={LOGO_DATA_URI} width={204} height={204} alt="" />
      </div>
    ),
    size,
  )
}

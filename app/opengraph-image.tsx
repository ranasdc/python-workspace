import { ImageResponse } from "next/og"
import { LOGO_DATA_URI, SITE } from "@/lib/site"

export const alt = SITE.title
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "linear-gradient(135deg, #0f172a 0%, #1b2233 55%, #2e1065 100%)",
          color: "#f8fafc",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <img src={LOGO_DATA_URI} width={96} height={96} alt="" />
          <div style={{ display: "flex", fontSize: 56, fontWeight: 700, letterSpacing: -1.5 }}>
            <span style={{ color: SITE.brandPurple }}>my</span>
            <span>code</span>
            <span style={{ color: SITE.brandBlue }}>pad</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.08, letterSpacing: -2, maxWidth: 980 }}>
            Python &amp; HTML IDEs built for the classroom
          </div>
          <div style={{ fontSize: 30, color: "#cbd5e1", maxWidth: 940, lineHeight: 1.35 }}>
            Students code in the browser. Teachers set work, mark and give feedback in one place.
          </div>
        </div>

        <div style={{ display: "flex", gap: 16, fontSize: 24, color: "#e2e8f0" }}>
          {["Students", "Teachers", "Schools & MATs"].map((label) => (
            <div
              key={label}
              style={{
                display: "flex",
                padding: "10px 22px",
                borderRadius: 999,
                border: "1px solid rgba(148,163,184,0.35)",
                background: "rgba(15,23,42,0.5)",
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  )
}

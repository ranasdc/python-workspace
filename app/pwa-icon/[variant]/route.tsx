import { ImageResponse } from "next/og"
import { LOGO_DATA_URI, SITE } from "@/lib/site"

export const dynamic = "force-static"
export const dynamicParams = false

const VARIANTS = {
  "192": { size: 192, maskable: false },
  "512": { size: 512, maskable: false },
  "maskable-512": { size: 512, maskable: true },
} as const

type Variant = keyof typeof VARIANTS

export function generateStaticParams() {
  return Object.keys(VARIANTS).map((variant) => ({ variant }))
}

export async function GET(_request: Request, { params }: { params: Promise<{ variant: string }> }) {
  const { variant } = await params
  const config = VARIANTS[variant as Variant]
  if (!config) return new Response("Not found", { status: 404 })

  const { size, maskable } = config
  // Maskable icons get cropped to any shape, so the logo sits inside the
  // central safe zone on a full-bleed tile in the logo's own background colour.
  const logoSize = maskable ? Math.round(size * 0.78) : size

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: maskable ? SITE.themeColor : "transparent",
        }}
      >
        <img src={LOGO_DATA_URI} width={logoSize} height={logoSize} alt="" />
      </div>
    ),
    { width: size, height: size },
  )
}

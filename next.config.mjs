/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Cross-origin isolation is required for SharedArrayBuffer, which lets the
  // Python worker block on input() while the user types in the console.
  // "credentialless" keeps cross-origin resources (the Pyodide CDN) loadable.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Embedder-Policy", value: "credentialless" },
        ],
      },
    ]
  },
}

export default nextConfig

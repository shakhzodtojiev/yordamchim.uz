/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Produces a slim self-contained server bundle at .next/standalone for
  // the Docker runtime stage (`node server.js` instead of `next start`).
  output: "standalone",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "*.supabase.in" },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb",
      // Next.js 14 rejects server actions when the request's Origin
      // doesn't match X-Forwarded-Host (CSRF guard). Behind nginx the
      // forwarded host can be the loopback (`127.0.0.1:10033`) while
      // Origin is the public domain — list every public origin the app
      // is served on so the guard accepts them. Proxy header alignment
      // is still preferred long-term.
      allowedOrigins: [
        "yordamchim.uz",
        "www.yordamchim.uz",
        "api.yordamchim.uz",
      ],
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;

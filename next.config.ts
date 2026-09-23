import type { NextConfig } from "next";

/**
 * في بيئة Docker نستخدم مخرجات "standalone" لتشغيل صورة صغيرة عبر `node server.js`.
 * محلياً (npm run dev / npm start) نُبقي المخرجات الافتراضية.
 */
const nextConfig: NextConfig = {
  output: process.env.DOCKER_BUILD === "1" ? "standalone" : undefined,
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "geolocation=(), camera=(), microphone=()" },
        ],
      },
    ];
  },
};

export default nextConfig;

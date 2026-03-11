import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // PDF worker dosyasının Vercel serverless bundle'ına dahil edilmesi
    outputFileTracingIncludes: {
      "/api/upload": [
        "./node_modules/pdf-parse/dist/pdf-parse/cjs/pdf.worker.mjs",
        "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
      ],
    },
  },
};

export default nextConfig;

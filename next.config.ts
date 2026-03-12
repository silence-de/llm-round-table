import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    '/*': [
      'node_modules/pdfkit/js/data/**',
      'node_modules/next/dist/compiled/@vercel/og/noto-sans-v27-latin-regular.ttf',
    ],
  },
};

export default nextConfig;

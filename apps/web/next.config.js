//@ts-check

const API_INTERNAL_URL = process.env.API_INTERNAL_URL ?? 'http://localhost:3001';

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async rewrites() {
    return [
      { source: '/trpc/:path*', destination: `${API_INTERNAL_URL}/trpc/:path*` },
      { source: '/api/:path*', destination: `${API_INTERNAL_URL}/api/:path*` },
      { source: '/images/:path*', destination: `${API_INTERNAL_URL}/images/:path*` },
    ];
  },
};

module.exports = nextConfig;

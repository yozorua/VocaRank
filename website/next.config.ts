import type { NextConfig } from "next";
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        pathname: '/**',
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: '/api/auth/me',
        destination: 'http://localhost:8000/auth/me',
      },
      {
        source: '/api/:path((?!auth/).*)',
        destination: 'http://localhost:8000/:path*',
      },
    ];
  },
};

export default withNextIntl(nextConfig);

import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,

  /**
   * Set once, here, and never mixed (PROJECT_PLAN.md §9.10). Mixing trailing
   * slash behaviour produces two crawlable URLs for every page and splits the
   * ranking signal between them.
   */
  trailingSlash: false,

  images: {
    // Every product, category, brand and industry image is served by
    // Cloudinary. Nothing else is allowed to load through next/image.
    remotePatterns: [{ protocol: 'https', hostname: 'res.cloudinary.com', pathname: '/**' }],
    formats: ['image/avif', 'image/webp'],
    // Matches the card / PDP / thumbnail presets in the Cloudinary service.
    deviceSizes: [640, 750, 828, 1080, 1200, 1600, 1920],
    imageSizes: [80, 120, 200, 400, 800],
  },

  eslint: {
    dirs: ['app', 'components', 'context', 'lib'],
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;

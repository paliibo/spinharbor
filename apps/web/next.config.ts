import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@spinharbor/contracts', '@spinharbor/ui'],
  typedRoutes: false,
};

export default nextConfig;

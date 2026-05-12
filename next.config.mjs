/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    instrumentationHook: true,
    serverComponentsExternalPackages: ["jsdom", "@mozilla/readability"],
  },
};

export default nextConfig;

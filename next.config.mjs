/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    instrumentationHook: true,
  },
  serverExternalPackages: ["jsdom", "@mozilla/readability"],
};

export default nextConfig;

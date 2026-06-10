/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@wcf/shared"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

module.exports = nextConfig;

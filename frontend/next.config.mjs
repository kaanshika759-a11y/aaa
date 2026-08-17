/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable strict mode for better debugging
  reactStrictMode: true,

  // Allow images from any https source (logo, avatar, etc.)
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },

  // Environment variables exposed to the browser
  env: {
    NEXT_PUBLIC_SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4000",
  },
};

export default nextConfig;

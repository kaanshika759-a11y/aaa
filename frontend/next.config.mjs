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

  async rewrites() {
    const backendUrl =
      process.env.NEXT_PUBLIC_BACKEND_URL ??
      process.env.BACKEND_URL ??
      "http://localhost:4000";
    return [
      {
        source: "/api/:path*",
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;


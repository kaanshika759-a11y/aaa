const nextConfig = {
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_SOCKET_URL: process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4000"
  },

  output: 'export',
  basePath: '/aaa',
};

export default nextConfig;


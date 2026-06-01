/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    async headers() {
          return [
            {
                      source: '/api/:path*',
                      headers: [
                        { key: 'Access-Control-Allow-Origin', value: '*' },
                        { key: 'Cache-Control', value: 'no-store, max-age=0' },
                                ],
            },
                ];
    },
    async rewrites() {
          return [
            { source: '/bags', destination: 'https://pablito-bags.vercel.app/bags' },
            { source: '/bags/:path*', destination: 'https://pablito-bags.vercel.app/bags/:path*' },
                ];
    },
};

export default nextConfig;
// Trigger deploy: rewrites /bags -> pablito-bags

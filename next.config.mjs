const isProd = process.env.NODE_ENV === 'production';

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(isProd
    ? {
        output: 'export',
        distDir: 'out',
        basePath: '/HackHub-WebUI',
        assetPrefix: '/HackHub-WebUI/',
        images: { 
          unoptimized: true,
          remotePatterns: [
            {
              protocol: 'https',
              hostname: '**',
            },
            {
              protocol: 'http',
              hostname: '**',
            },
          ],
        },
      }
    : {
        // Keep dev output in .next to avoid self-triggering file watchers
        distDir: '.next',
        basePath: '',
        assetPrefix: '',
        images: { 
          unoptimized: false,
          remotePatterns: [
            {
              protocol: 'https',
              hostname: '**',
            },
            {
              protocol: 'http',
              hostname: '**',
            },
          ],
        },
        // When using the webpack dev server, ignore generated dirs to prevent rebuild loops
        webpackDevMiddleware(config) {
          config.watchOptions = {
            ...(config.watchOptions ?? {}),
            ignored: ['**/node_modules/**', '**/.git/**', '**/.next/**', '**/out/**'],
          };
          return config;
        },
      }),
};

export default nextConfig;

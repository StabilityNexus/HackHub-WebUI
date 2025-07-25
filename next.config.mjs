const nextConfig = {
  output: 'export',
  distDir: 'out',
  basePath: process.env.NODE_ENV === 'production' ? '/HackHub-WebUI' : '',
  assetPrefix: process.env.NODE_ENV === 'production' ? '/HackHub-WebUI/' : '',
  images: {
      unoptimized: true,
  }
};

export default nextConfig;

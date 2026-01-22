/** @type {import('next').NextConfig} */
const nextConfig = {
  // Webpack configuration to fix HMR issues
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      // Disable cache for better HMR stability
      config.cache = false;
      
      // Use named module IDs for better HMR tracking
      config.optimization = {
        ...config.optimization,
        moduleIds: 'named',
        chunkIds: 'named',
      };
    }
    return config;
  },
  
  // Disable React Strict Mode temporarily to avoid HMR issues
  reactStrictMode: false,
  
  // Experimental optimizations
  experimental: {
    optimizePackageImports: ['lucide-react', 'recharts'],
  },
};

module.exports = nextConfig;

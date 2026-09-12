import type { NextConfig } from 'next';
const config: NextConfig = {
  serverExternalPackages: ['@electric-sql/pglite', 'pg', 'pdf-parse'],
  poweredByHeader: false,
  devIndicators: false,
};
export default config;

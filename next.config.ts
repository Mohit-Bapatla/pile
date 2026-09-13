import type { NextConfig } from 'next';
const config: NextConfig = {
  serverExternalPackages: ['@electric-sql/pglite', 'pg', 'pdf-parse', '@napi-rs/canvas'],
  outputFileTracingIncludes: {
    '/api/*': [
      './migrations/*.sql',
      './demo-assets/*',
      './node_modules/.pnpm/pdfjs-dist*/node_modules/pdfjs-dist/legacy/build/*',
    ],
  },
  poweredByHeader: false,
  devIndicators: false,
};
export default config;

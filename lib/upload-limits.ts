// Vercel's multipart request limit is 4.5 MB; leave room for form metadata.
// Local installs retain their existing 8 MB limit unless configured otherwise.
export const MAX_UPLOAD_MB = process.env.NEXT_PUBLIC_MAX_UPLOAD_MB === '4' ? 4 : 8;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

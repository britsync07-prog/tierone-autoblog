import fs from 'node:fs';

// Build-time existence check for the owner-supplied headshot (D-17).
// Evaluated at module load: inside the Server Component graph this runs
// during `next build`, so statically prerendered pages bake the result in.
// Owner step: drop the real headshot at public/images/author.jpg and the
// photo replaces the initials monogram on the next build. No synthetic or
// stock imagery is ever used here — real photo or monogram, nothing else.
export const AUTHOR_PHOTO_EXISTS: boolean = fs.existsSync(
  'public/images/author.jpg',
);

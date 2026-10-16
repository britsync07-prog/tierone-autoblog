import Image from 'next/image';
import { AUTHOR_NAME, LINKEDIN_URL, GITHUB_URL } from '@/lib/site';
import { AUTHOR_PHOTO_EXISTS } from '@/lib/author-photo';

// Shared publisher identity card (D-12, D-17). Server Component, zero JS.
// Photo block uses the real owner-supplied headshot when it exists at
// build; otherwise an initials monogram renders. Owner step: drop the real
// headshot at public/images/author.jpg to replace the monogram.
const AUTHOR_ROLE = 'Full-Stack Product Engineer based in Bangladesh';

export default function AuthorCard({ showPhoto }: { showPhoto: boolean }) {
  const showImage = showPhoto && AUTHOR_PHOTO_EXISTS;
  return (
    <div className="flex items-center gap-4">
      {showImage ? (
        <Image
          src="/images/author.jpg"
          alt="Portrait of Musfiqur Rahman Saimon"
          width={200}
          height={200}
          priority={false}
          className="shrink-0 rounded-full"
        />
      ) : (
        <div
          role="img"
          aria-label="Initials monogram for Musfiqur Rahman Saimon"
          className="grid h-[200px] w-[200px] shrink-0 place-items-center rounded-full bg-[#4f46e5] text-5xl font-semibold text-white"
        >
          MS
        </div>
      )}
      <div>
        <p className="text-[16px] font-semibold text-[#171717]">{AUTHOR_NAME}</p>
        <p className="mt-1 text-[14px] text-slate-600">{AUTHOR_ROLE}</p>
        <p className="mt-2 text-[14px]">
          <a
            href={LINKEDIN_URL}
            rel="me noopener"
            className="text-[#4f46e5] underline"
          >
            LinkedIn
          </a>
          <span aria-hidden="true" className="mx-2 text-slate-300">
            ·
          </span>
          <a
            href={GITHUB_URL}
            rel="me noopener"
            className="text-[#4f46e5] underline"
          >
            GitHub
          </a>
        </p>
      </div>
    </div>
  );
}

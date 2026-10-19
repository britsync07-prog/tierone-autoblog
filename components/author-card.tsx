import Image from 'next/image';
import { AUTHOR_NAME, LINKEDIN_URL, GITHUB_URL } from '@/lib/site';
import { AUTHOR_PHOTO_EXISTS } from '@/lib/author-photo';

// Shared publisher identity card. Server Component, zero JS.
const AUTHOR_ROLE = 'Full-Stack Product Engineer based in Bangladesh';

export default function AuthorCard({ showPhoto }: { showPhoto: boolean }) {
  const showImage = showPhoto && AUTHOR_PHOTO_EXISTS;
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 rounded-sm bg-[#f4f4f6] p-6 sm:p-8">
      {showImage ? (
        <Image
          src="/images/author.jpg"
          alt="Portrait of Musfiqur Rahman Saimon"
          width={120}
          height={120}
          priority={false}
          className="shrink-0 rounded-full"
        />
      ) : (
        <div
          role="img"
          aria-label="Initials monogram for Musfiqur Rahman Saimon"
          className="grid h-24 w-24 shrink-0 place-items-center rounded-sm bg-[#d92b21] text-3xl font-extrabold text-white"
        >
          MS
        </div>
      )}
      <div>
        <p className="text-2xl font-bold tracking-tight text-[#09090b]">{AUTHOR_NAME}</p>
        <p className="mt-1 text-sm text-[#52525b] leading-relaxed">{AUTHOR_ROLE}</p>
        <p className="mt-4 flex items-center gap-3 text-sm">
          <a
            href={LINKEDIN_URL}
            rel="me noopener"
            className="font-semibold text-[#d92b21] underline underline-offset-4 transition-colors hover:text-[#09090b]"
          >
            LinkedIn
          </a>
          <span aria-hidden="true" className="text-[#a1a1aa]">
            ·
          </span>
          <a
            href={GITHUB_URL}
            rel="me noopener"
            className="font-semibold text-[#d92b21] underline underline-offset-4 transition-colors hover:text-[#09090b]"
          >
            GitHub
          </a>
        </p>
      </div>
    </div>
  );
}

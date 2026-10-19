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
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 rounded-2xl border border-white/[0.08] bg-[#121215] p-6 sm:p-8 shadow-xl">
      {showImage ? (
        <Image
          src="/images/author.jpg"
          alt="Portrait of Musfiqur Rahman Saimon"
          width={140}
          height={140}
          priority={false}
          className="shrink-0 rounded-full border-2 border-emerald-500/40 shadow-lg"
        />
      ) : (
        <div
          role="img"
          aria-label="Initials monogram for Musfiqur Rahman Saimon"
          className="grid h-28 w-28 shrink-0 place-items-center rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-emerald-400 text-3xl font-extrabold text-white shadow-xl shadow-emerald-950/30"
        >
          MS
        </div>
      )}
      <div>
        <p className="text-2xl font-bold tracking-tight text-white">{AUTHOR_NAME}</p>
        <p className="mt-1 text-sm text-zinc-300 leading-relaxed">{AUTHOR_ROLE}</p>
        <p className="mt-3.5 flex items-center gap-3 text-sm">
          <a
            href={LINKEDIN_URL}
            rel="me noopener"
            className="inline-flex items-center gap-1.5 font-medium text-emerald-400 underline underline-offset-4 transition-colors hover:text-emerald-300"
          >
            LinkedIn
          </a>
          <span aria-hidden="true" className="text-zinc-600">
            ·
          </span>
          <a
            href={GITHUB_URL}
            rel="me noopener"
            className="inline-flex items-center gap-1.5 font-medium text-emerald-400 underline underline-offset-4 transition-colors hover:text-emerald-300"
          >
            GitHub
          </a>
        </p>
      </div>
    </div>
  );
}

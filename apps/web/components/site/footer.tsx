import { Music4 } from 'lucide-react';

import { GithubIcon, XIcon, YoutubeIcon } from './social-icons';

// URLs ported verbatim from v1 (git show carnaby-sk-origin:views/partials/footer.ejs).
// Note: v1 labels its SoundCloud link "Spotify" — kept as-is for parity.
const SOCIAL_LINKS = [
  { label: 'GitHub', href: 'https://github.com/carnaby/carnaby.sk', icon: GithubIcon },
  { label: 'Twitter/X', href: 'https://x.com/jozef_sokol', icon: XIcon },
  { label: 'YouTube', href: 'https://www.youtube.com/@jozefsokol3820', icon: YoutubeIcon },
  { label: 'Spotify', href: 'https://soundcloud.com/jozef-sokol', icon: Music4 },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-4 py-10 text-white/70">
        <div className="flex items-center gap-5">
          {SOCIAL_LINKS.map(({ label, href, icon: Icon }) => (
            <a
              key={label}
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              aria-label={label}
              className="text-white/60 transition-colors hover:text-white"
            >
              <Icon size={20} aria-hidden="true" />
            </a>
          ))}
        </div>
        <p className="text-sm">&copy; 2026 Jozef Sokol. Code &amp; Music.</p>
      </div>
    </footer>
  );
}

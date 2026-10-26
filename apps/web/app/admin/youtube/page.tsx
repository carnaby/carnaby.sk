import type { Metadata } from 'next';

import { YoutubeOverview } from '../../../components/admin/youtube-overview';

export const metadata: Metadata = {
  title: 'YouTube — Administrácia',
};

/** `/admin/youtube`: the channel's videos next to what is on the site, with one-click import. */
export default function AdminYoutubePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-white">YouTube</h1>
        <p className="mt-1 text-sm text-white/60">
          Videá z kanála a ich stav na webe. Chýbajúce video uverejníš jedným klikom — názov, popis, dátum vydania aj
          náhľad sa stiahnu z YouTube.
        </p>
      </div>
      <YoutubeOverview />
    </div>
  );
}

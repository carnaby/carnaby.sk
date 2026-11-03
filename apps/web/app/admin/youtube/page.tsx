import type { Metadata } from 'next';

import { PageHeader } from '../../../components/admin/page-header';
import { YoutubeOverview } from '../../../components/admin/youtube-overview';

export const metadata: Metadata = {
  title: 'YouTube — Administrácia',
};

/** `/admin/youtube`: the channel's videos next to what is on the site, with one-click import. */
export default function AdminYoutubePage() {
  return (
    <>
      <PageHeader
        title="YouTube"
        description="Videá z kanála a ich stav na webe. Uverejnenie stiahne názov, popis, dátum vydania aj náhľad."
      />
      <YoutubeOverview />
    </>
  );
}

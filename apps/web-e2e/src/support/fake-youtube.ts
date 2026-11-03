import { createServer, type Server } from 'node:http';

/**
 * Minimal stand-in for the YouTube Data API v3 (`channels`, `playlistItems`, `videos`) -- just
 * enough for the api's `youtube.overview` / `youtube.import`. Used only when the api is pointed at
 * it via `YOUTUBE_API_BASE_URL=http://localhost:<port>` (see global-setup.ts).
 */
export const FAKE_VIDEOS = {
  E2EVIDEO001: {
    title: 'E2E – Testovacie video',
    description: 'Popis testovacieho videa pre e2e.',
    lang: 'sk',
    at: '2026-06-01T17:00:00Z',
    duration: 'PT3M10S',
  },
} as const;

export type FakeVideoId = keyof typeof FAKE_VIDEOS;

export function startFakeYoutube(port: number): Promise<Server> {
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const send = (body: unknown) => {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (url.pathname.endsWith('/channels')) {
      return send({
        items: [{ id: 'UCe2efake', snippet: { title: 'E2E Channel' }, contentDetails: { relatedPlaylists: { uploads: 'UUe2efake' } } }],
      });
    }
    if (url.pathname.endsWith('/playlistItems')) {
      return send({ items: Object.keys(FAKE_VIDEOS).map((videoId) => ({ contentDetails: { videoId } })) });
    }
    if (url.pathname.endsWith('/videos')) {
      const ids = (url.searchParams.get('id') ?? '').split(',').filter((id): id is FakeVideoId => id in FAKE_VIDEOS);
      return send({
        items: ids.map((id) => {
          const v = FAKE_VIDEOS[id];
          return {
            id,
            snippet: {
              channelId: 'UCe2efake',
              channelTitle: 'E2E Channel',
              title: v.title,
              description: v.description,
              publishedAt: v.at,
              defaultLanguage: v.lang,
              thumbnails: {},
            },
            contentDetails: { duration: v.duration },
            statistics: { viewCount: '42' },
          };
        }),
      });
    }
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end('{}');
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, () => resolve(server));
  });
}

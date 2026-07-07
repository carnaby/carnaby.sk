export type ThumbWidth = 300 | 600 | 1200 | 1920;

/**
 * Builds a URL for a post thumbnail at a given width. `filename` is the bare
 * filename stored on `posts.thumbnailPath` (see `saveThumbnail`/
 * `fetchYoutubeThumbnail` in `apps/api/src/uploads/uploads.service.ts` — never
 * a path with a directory prefix). Next's `rewrites()` (`next.config.js`)
 * proxies `/images/*` to the api's `GET /images/:width/:filename` (sharp
 * resize + disk cache, v1 URL contract), so this is a same-origin path, not
 * an absolute URL.
 */
export function thumbUrl(filename: string, width: ThumbWidth): string {
  return `/images/${width}/${filename}`;
}

/** YouTube's stock `hqdefault` thumbnail — used when a post has a `youtubeId`
 * but no uploaded thumbnail of its own. */
export function youtubeThumbUrl(youtubeId: string): string {
  return `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;
}

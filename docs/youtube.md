# YouTube sync

Turns YouTube videos into posts without retyping anything.

- **`/admin/youtube`** lists every public video of the configured channels, newest first, next to
  its status on the site (*Na webe* / *Koncept* / *Archivované* / *Chýba*). Missing videos have
  **Uverejniť** (publish now) and **Ako koncept** (draft).
- **Post editor → "Načítať z YouTube"** (next to the YouTube ID field) refills the form from the
  video: only the languages the video has text in, plus release date and still. A language the
  video has no text for is left exactly as it is (empty stays empty). Nothing is saved until you
  click a save button.
- **MCP**: `youtube_overview`, `import_youtube_video`, `sync_post_from_youtube` (`docs/mcp.md`).

Code: `apps/api/src/youtube/` (API client, service, tRPC router), mapping rules in
`packages/shared/src/youtube.ts`.

## What is taken from YouTube

| Post field | From the video |
|---|---|
| Title | Video title |
| Content | Description → markdown (paragraphs and line breaks kept, URLs become links, `#hashtags` and other markdown characters escaped). Empty description → a link to the video. |
| Excerpt / meta description | First real paragraph of the description (link/hashtag-only paragraphs skipped), shortened to 200 / 155 characters |
| Publish date | Video release date |
| Thumbnail | Best available still (`maxresdefault` → `sddefault` → `hqdefault`) saved as `yt-<id>.jpg` |
| Category | The channel's category from `YOUTUBE_CHANNELS` (import only) |
| Slug | From the SK title, `-2`, `-3`… when taken (import only) |

### Languages

The video's own text belongs to its **video language** set in YouTube Studio (assumed Slovak when
the video has none). Translations added in YouTube Studio (*Subtitles → Title & description*) map
to their languages.

- A language YouTube has text in → that text.
- A language YouTube doesn't have, but the post already has (e.g. translated via MCP) → **kept**.
- A language neither has → the video's own text, so a new post is complete in both languages.
  Then translate it, e.g. ask Claude: *"preložte post X do angličtiny"*.

Re-syncing therefore refreshes YouTube's texts but never overwrites your own translation with
text in the wrong language.

## Setup

1. Google Cloud Console (the same project as the OAuth client is fine) → *APIs & Services* →
   enable **YouTube Data API v3** → *Credentials* → **Create API key** → restrict it to that API.
2. In the NAS `.env`:
   ```
   YOUTUBE_API_KEY=AIza...
   YOUTUBE_CHANNELS=@yourhandle=carnaby
   ```
   One entry per channel, comma-separated; `=category` (devlog | dodo | carnaby) is optional.
   A channel can be given as `@handle` or `UC…` channel id.
3. `docker compose up -d` (recreates the api with the new env).

Quota: the free 10,000 units/day are plenty — listing a channel costs ~1 unit per 50 videos (x2),
importing a video 1 unit. Channel listings are cached for 10 minutes; *Obnoviť z YouTube*
bypasses the cache. Only public videos are visible to an API key.

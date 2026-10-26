import { parseIsoDuration, youtubeTranslations, type YoutubeText, type YoutubeTranslations } from '@carnaby/shared';

/** YOUTUBE_API_KEY / YOUTUBE_CHANNELS are not set. */
export class YoutubeNotConfiguredError extends Error {}
/** The YouTube API refused or failed the request (bad key, quota, network, ...). */
export class YoutubeApiError extends Error {}
export class YoutubeVideoNotFoundError extends Error {}

export interface YoutubeChannelConfig {
  /** Channel id (`UC…`) or handle (`@name`). */
  ref: string;
  /** Category slug new posts from this channel get. */
  category?: string;
}

/** `YOUTUBE_CHANNELS=@carnaby=carnaby,UCxxxx=dodo` → one entry per channel; `=category` optional. */
export function parseChannelConfig(raw: string | undefined): YoutubeChannelConfig[] {
  return (raw ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [ref = '', category] = entry.split('=').map((part) => part.trim());
      return category ? { ref, category } : { ref };
    })
    .filter((c) => c.ref);
}

export interface YoutubeChannel {
  id: string;
  title: string;
  uploadsPlaylistId: string;
}

export interface YoutubeVideo {
  id: string;
  channelId: string;
  channelTitle: string;
  /** Title in the video's own language (the YouTube Studio default). */
  title: string;
  publishedAt: string;
  durationSeconds: number;
  /** 320×180 still for list views. */
  thumbnailUrl: string | null;
  viewCount: number | null;
  translations: YoutubeTranslations;
}

interface ApiVideo {
  id: string;
  snippet?: {
    channelId: string;
    channelTitle: string;
    title: string;
    description: string;
    publishedAt: string;
    defaultLanguage?: string;
    defaultAudioLanguage?: string;
    thumbnails?: Record<string, { url: string } | undefined>;
  };
  contentDetails?: { duration?: string };
  statistics?: { viewCount?: string };
  localizations?: Record<string, YoutubeText>;
}

const DEFAULT_BASE_URL = 'https://www.googleapis.com/youtube/v3';
const MAX_IDS_PER_CALL = 50;

export class YoutubeClient {
  constructor(
    private readonly apiKey: string,
    // Overridable for tests / a local fake; production always uses the real API.
    private readonly baseUrl = process.env['YOUTUBE_API_BASE_URL'] ?? DEFAULT_BASE_URL,
  ) {}

  private async get<T>(resource: string, params: Record<string, string>): Promise<T> {
    const url = new URL(`${this.baseUrl}/${resource}`);
    for (const [key, value] of Object.entries({ ...params, key: this.apiKey })) url.searchParams.set(key, value);
    let res: Response;
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    } catch (error) {
      throw new YoutubeApiError(`YouTube API unreachable: ${error instanceof Error ? error.message : String(error)}`);
    }
    const body = (await res.json().catch(() => null)) as { error?: { message?: string; errors?: { reason?: string }[] } } | null;
    if (!res.ok) {
      const reason = body?.error?.errors?.[0]?.reason;
      const message = body?.error?.message ?? `HTTP ${res.status}`;
      throw new YoutubeApiError(`YouTube API error${reason ? ` (${reason})` : ''}: ${message}`);
    }
    return body as T;
  }

  async resolveChannel(ref: string): Promise<YoutubeChannel> {
    const lookup: Record<string, string> = ref.startsWith('UC') ? { id: ref } : { forHandle: ref.startsWith('@') ? ref : `@${ref}` };
    const data = await this.get<{ items?: { id: string; snippet: { title: string }; contentDetails: { relatedPlaylists: { uploads: string } } }[] }>(
      'channels',
      { part: 'snippet,contentDetails', ...lookup },
    );
    const channel = data.items?.[0];
    if (!channel) throw new YoutubeApiError(`YouTube channel "${ref}" not found`);
    return { id: channel.id, title: channel.snippet.title, uploadsPlaylistId: channel.contentDetails.relatedPlaylists.uploads };
  }

  /** Ids of all public uploads of a channel, newest first. */
  async listUploadIds(uploadsPlaylistId: string): Promise<string[]> {
    const ids: string[] = [];
    let pageToken: string | undefined;
    do {
      const data = await this.get<{ items?: { contentDetails: { videoId: string } }[]; nextPageToken?: string }>('playlistItems', {
        part: 'contentDetails',
        playlistId: uploadsPlaylistId,
        maxResults: String(MAX_IDS_PER_CALL),
        ...(pageToken ? { pageToken } : {}),
      });
      ids.push(...(data.items ?? []).map((item) => item.contentDetails.videoId));
      pageToken = data.nextPageToken;
    } while (pageToken);
    return ids;
  }

  async getVideos(ids: string[]): Promise<YoutubeVideo[]> {
    const videos: YoutubeVideo[] = [];
    for (let i = 0; i < ids.length; i += MAX_IDS_PER_CALL) {
      const data = await this.get<{ items?: ApiVideo[] }>('videos', {
        part: 'snippet,contentDetails,statistics,localizations',
        id: ids.slice(i, i + MAX_IDS_PER_CALL).join(','),
      });
      for (const item of data.items ?? []) {
        const video = toVideo(item);
        if (video) videos.push(video);
      }
    }
    return videos;
  }

  async getVideo(id: string): Promise<YoutubeVideo> {
    const [video] = await this.getVideos([id]);
    if (!video) throw new YoutubeVideoNotFoundError(`YouTube video "${id}" not found (or not public)`);
    return video;
  }
}

function toVideo(item: ApiVideo): YoutubeVideo | null {
  const s = item.snippet;
  if (!s) return null;
  const thumbs = s.thumbnails ?? {};
  return {
    id: item.id,
    channelId: s.channelId,
    channelTitle: s.channelTitle,
    title: s.title,
    publishedAt: s.publishedAt,
    durationSeconds: parseIsoDuration(item.contentDetails?.duration),
    thumbnailUrl: (thumbs['medium'] ?? thumbs['high'] ?? thumbs['default'])?.url ?? null,
    viewCount: item.statistics?.viewCount ? Number(item.statistics.viewCount) : null,
    translations: youtubeTranslations(
      item.id,
      { title: s.title, description: s.description ?? '' },
      s.defaultLanguage ?? s.defaultAudioLanguage,
      item.localizations,
    ),
  };
}

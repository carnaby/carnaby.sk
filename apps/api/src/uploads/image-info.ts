import { appUrl } from '../auth/auth';
import { IMAGE_WIDTHS } from './uploads.service';

export interface ImageInfo {
  filename: string;
  urls: Record<string, string>;
  markdown: string;
}

/** Public URLs of every served width plus a markdown snippet for post content. */
export function imageInfo(filename: string): ImageInfo {
  const base = appUrl();
  return {
    filename,
    urls: Object.fromEntries(IMAGE_WIDTHS.map((w) => [w, `${base}/images/${w}/${filename}`])),
    markdown: `![](/images/1200/${filename})`,
  };
}

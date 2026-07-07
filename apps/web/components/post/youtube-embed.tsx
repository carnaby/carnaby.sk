export interface YoutubeEmbedProps {
  youtubeId: string;
  title: string;
}

/** Post media block for a YouTube-backed post. Uses the `-nocookie` domain so the embed doesn't
 * set tracking cookies (or trip a cookie-consent requirement) until the visitor presses play. */
export function YoutubeEmbed({ youtubeId, title }: YoutubeEmbedProps) {
  return (
    <div className="aspect-video overflow-hidden rounded-glass bg-surface">
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${youtubeId}`}
        title={title}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        className="h-full w-full"
      />
    </div>
  );
}

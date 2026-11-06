'use client';

import { useRef, useState } from 'react';
import { CirclePlay, ImageOff, Link2, Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { thumbUrl } from '../../lib/images';
import { Button } from '../ui/button';
import { Label } from '../ui/label';

export interface ThumbnailPickerProps {
  /** Bare filename stored on `posts.thumbnailPath` (see `thumbUrl`'s doc comment), or `''` when
   * the post has no uploaded thumbnail yet. */
  value: string;
  onChange: (filename: string) => void;
  /** The editor's current `youtubeId` field value — "Z YouTube" fetches a stock thumbnail for
   * whatever id is currently typed there, so this must stay live as the caller's state changes. */
  youtubeId: string;
  /** The editor's current "Odkaz na projekt" value — "Z odkazu" takes that page's share image (og:image). */
  projectUrl: string;
}

interface UploadErrorBody {
  message?: string;
}

/** Reads a REST error response's JSON body for its `message`, falling back to a generic Slovak
 * message when the body isn't JSON or has none — same "surface the server's own message" contract
 * as the mutation `onError` handlers elsewhere in the admin area. */
async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as UploadErrorBody;
    return body.message ?? fallback;
  } catch {
    return fallback;
  }
}

/**
 * `<PostEditor>`'s thumbnail control (Task 21): shows the current thumbnail (if any) at 300px via
 * `thumbUrl`, and three upload paths — a hidden file input triggered by "Nahrať"
 * (`POST /api/uploads/thumbnail`, multipart), "Z YouTube" (`POST /api/uploads/from-youtube`)
 * which uses whatever `youtubeId` is currently typed into the editor's own field, and "Z odkazu"
 * (`POST /api/uploads/from-link`) which takes the share image of the typed project link. All REST
 * calls are same-origin, so the browser already sends the admin session cookie — no auth header needed.
 */
export function ThumbnailPicker({ value, onChange, youtubeId, projectUrl }: ThumbnailPickerProps) {
  const [uploading, setUploading] = useState(false);
  const [fetchingYoutube, setFetchingYoutube] = useState(false);
  const [fetchingLink, setFetchingLink] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const busy = uploading || fetchingYoutube || fetchingLink;

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Reset immediately so picking the exact same file again still fires a change event.
    event.target.value = '';
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('thumbnail', file);
      const res = await fetch('/api/uploads/thumbnail', { method: 'POST', body: formData });
      if (!res.ok) {
        throw new Error(await readErrorMessage(res, 'Nahrávanie náhľadového obrázka sa nepodarilo.'));
      }
      const data = (await res.json()) as { filename: string };
      onChange(data.filename);
      toast.success('Náhľadový obrázok bol nahraný.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Nahrávanie náhľadového obrázka sa nepodarilo.');
    } finally {
      setUploading(false);
    }
  }

  async function handleFromYoutube() {
    const id = youtubeId.trim();
    if (!id) {
      toast.error('Najprv zadajte YouTube ID.');
      return;
    }

    setFetchingYoutube(true);
    try {
      const res = await fetch('/api/uploads/from-youtube', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ youtubeId: id }),
      });
      if (!res.ok) {
        throw new Error(await readErrorMessage(res, 'Stiahnutie náhľadu z YouTube sa nepodarilo.'));
      }
      const data = (await res.json()) as { filename: string };
      onChange(data.filename);
      toast.success('Náhľadový obrázok bol stiahnutý z YouTube.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Stiahnutie náhľadu z YouTube sa nepodarilo.');
    } finally {
      setFetchingYoutube(false);
    }
  }

  async function handleFromLink() {
    const url = projectUrl.trim();
    if (!url) {
      toast.error('Najprv zadajte odkaz na projekt.');
      return;
    }

    setFetchingLink(true);
    try {
      const res = await fetch('/api/uploads/from-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      if (!res.ok) {
        throw new Error(await readErrorMessage(res, 'Stiahnutie náhľadu z odkazu sa nepodarilo.'));
      }
      const data = (await res.json()) as { filename: string };
      onChange(data.filename);
      toast.success('Náhľadový obrázok bol stiahnutý z odkazu.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Stiahnutie náhľadu z odkazu sa nepodarilo.');
    } finally {
      setFetchingLink(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Label>Náhľadový obrázok</Label>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex aspect-video w-full shrink-0 items-center justify-center overflow-hidden rounded-lg border border-line bg-surface sm:w-48">
          {value ? (
            // Plain <img>, not next/image -- same rationale as PostImage: this is a same-origin
            // `/images/:width/:filename` path already served pre-resized by the api.
            <img src={thumbUrl(value, 600)} alt="Náhľad príspevku" className="h-full w-full object-cover" />
          ) : (
            <span className="flex flex-col items-center gap-1 text-xs text-white/35">
              <ImageOff size={22} aria-hidden="true" />
              {youtubeId.trim() ? 'Použije sa náhľad z YouTube' : 'Bez obrázka'}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2 sm:flex-col">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
            aria-label="Nahrať náhľadový obrázok"
          />
          <Button type="button" variant="outline" className="h-10 flex-1 sm:h-8 sm:flex-none" disabled={busy} onClick={() => fileInputRef.current?.click()}>
            {uploading ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Upload aria-hidden="true" />}
            {uploading ? 'Nahrávam…' : 'Nahrať'}
          </Button>
          <Button type="button" variant="outline" className="h-10 flex-1 sm:h-8 sm:flex-none" disabled={busy || !youtubeId.trim()} onClick={handleFromYoutube}>
            {fetchingYoutube ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <CirclePlay aria-hidden="true" />}
            {fetchingYoutube ? 'Sťahujem…' : 'Z YouTube'}
          </Button>
          <Button type="button" variant="outline" className="h-10 flex-1 sm:h-8 sm:flex-none" disabled={busy || !projectUrl.trim()} onClick={handleFromLink}>
            {fetchingLink ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Link2 aria-hidden="true" />}
            {fetchingLink ? 'Sťahujem…' : 'Z odkazu'}
          </Button>
          {value ? (
            <Button type="button" variant="ghost" className="h-10 sm:h-8" disabled={busy} onClick={() => onChange('')}>
              Odstrániť
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

'use client';

import { useRef, useState } from 'react';
import { ImageOff, Loader2 } from 'lucide-react';
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
 * `thumbUrl`, and two upload paths — a hidden file input triggered by "Nahrať"
 * (`POST /api/uploads/thumbnail`, multipart), and "Z YouTube" (`POST /api/uploads/from-youtube`)
 * which uses whatever `youtubeId` is currently typed into the editor's own field. Both REST calls
 * are same-origin, so the browser already sends the admin session cookie — no auth header needed.
 */
export function ThumbnailPicker({ value, onChange, youtubeId }: ThumbnailPickerProps) {
  const [uploading, setUploading] = useState(false);
  const [fetchingYoutube, setFetchingYoutube] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const busy = uploading || fetchingYoutube;

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

  return (
    <div className="flex flex-col gap-2">
      <Label>Náhľadový obrázok</Label>
      <div className="flex items-center gap-4">
        <div className="flex h-20 w-32 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface">
          {value ? (
            // Plain <img>, not next/image -- same rationale as PostImage: this is a same-origin
            // `/images/:width/:filename` path already served pre-resized by the api.
            <img src={thumbUrl(value, 300)} alt="Náhľad príspevku" className="h-full w-full object-cover" />
          ) : (
            <ImageOff className="text-white/25" size={22} aria-hidden="true" />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
            aria-label="Nahrať náhľadový obrázok"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
            {uploading ? 'Nahrávam…' : 'Nahrať'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy || !youtubeId.trim()}
            onClick={handleFromYoutube}
          >
            {fetchingYoutube ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : null}
            {fetchingYoutube ? 'Sťahujem…' : 'Z YouTube'}
          </Button>
          {value ? (
            <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => onChange('')}>
              Odstrániť
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

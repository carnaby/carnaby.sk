import type { Db } from '@carnaby/db';
import { TRPCError } from '@trpc/server';
import type { IncomingMessage } from 'node:http';
import { savePostChanges } from '../posts/post-changes';
import { imageInfo, type ImageInfo } from './image-info';
import { claimUploadLink, completeUploadLink, findUsableUploadLink, releaseUploadLink } from './upload-links';
import { deleteOriginal, saveImageBuffer } from './uploads.service';

/** Unknown, expired or already used token (also: its target post is gone -- the link row cascades). */
export class UploadLinkInvalidError extends Error {
  constructor() {
    super('Upload link is invalid, expired or already used -- call create_image_upload again.');
  }
}

export class ImageTooLargeError extends Error {
  constructor() {
    super('Image too large (max 10 MB).');
  }
}

/** How long a too-large request may stay silent before we answer anyway. Next's proxy cuts a body
 * above its limit short but forwards the original Content-Length, so the rest never arrives. */
export const DRAIN_IDLE_MS = 2_000;
/** Upper bound for draining at all, so a client trickling bytes cannot keep the request open. */
export const DRAIN_MAX_MS = 30_000;

/** Reads and discards the rest of the request, so the client gets our response instead of a
 * connection reset while it is still sending. Settles on end/close/error, after DRAIN_IDLE_MS
 * without data, or after DRAIN_MAX_MS -- whichever comes first. */
function drain(req: IncomingMessage): Promise<void> {
  if (req.readableEnded || req.destroyed) return Promise.resolve();
  return new Promise((resolve) => {
    let idle: NodeJS.Timeout | undefined;
    const done = () => {
      clearTimeout(idle);
      clearTimeout(max);
      req.off('data', onData);
      req.off('end', done);
      req.off('close', done);
      req.off('error', done);
      resolve(); // the stream keeps flowing (resumed), so whatever still comes is discarded
    };
    const onData = () => {
      clearTimeout(idle);
      idle = setTimeout(done, DRAIN_IDLE_MS);
    };
    const max = setTimeout(done, DRAIN_MAX_MS);
    onData();
    req.on('data', onData);
    req.on('end', done);
    req.on('close', done);
    req.on('error', done);
    req.resume();
  });
}

/** The raw request body, at most `maxBytes`. A larger body (declared or streamed) is drained and
 * then rejected with ImageTooLargeError. */
export async function readBodyCapped(req: IncomingMessage, maxBytes: number): Promise<Buffer> {
  const declared = Number(req.headers['content-length']);
  if (Number.isFinite(declared) && declared > maxBytes) {
    await drain(req);
    throw new ImageTooLargeError();
  }
  // Already consumed by a body parser (a JSON Content-Type): nothing left to read.
  if (req.readableEnded) return Buffer.alloc(0);

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let total = 0;
    const cleanup = () => {
      req.off('data', onData);
      req.off('end', onEnd);
      req.off('error', onError);
      req.off('close', onClose);
    };
    const onData = (chunk: Buffer) => {
      total += chunk.length;
      if (total > maxBytes) {
        cleanup();
        chunks.length = 0;
        void drain(req).then(() => reject(new ImageTooLargeError()));
      } else {
        chunks.push(chunk);
      }
    };
    const onEnd = () => {
      cleanup();
      resolve(Buffer.concat(chunks, total));
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const onClose = () => {
      cleanup();
      reject(new Error('request closed before the body was complete'));
    };
    req.on('data', onData);
    req.on('end', onEnd);
    req.on('error', onError);
    req.on('close', onClose);
  });
}

export type LinkUploadResult = ImageInfo & { thumbnailOfPostId: number | null };

/** One upload through a one-time link: the token is checked before the body is read, claimed
 * atomically after it, and released again when the upload fails so the link can be retried. */
export async function receiveLinkUpload(db: Db, token: string, readBody: () => Promise<Buffer>): Promise<LinkUploadResult> {
  if (!(await findUsableUploadLink(db, token))) throw new UploadLinkInvalidError();
  const body = await readBody();
  const link = await claimUploadLink(db, token);
  if (!link) throw new UploadLinkInvalidError();

  let filename: string | undefined;
  let postUpdated = false;
  try {
    filename = await saveImageBuffer(body, link.thumbnailPostId ? 'thumb' : 'img');
    if (link.thumbnailPostId) {
      await savePostChanges(db, link.thumbnailPostId, { thumbnailPath: filename }, link.createdBy);
      postUpdated = true;
    }
    await completeUploadLink(db, link.id, filename);
  } catch (error) {
    // Drop a file nothing points to; a thumbnail already set on the post stays. A failing cleanup
    // is only logged: the caller must see the original error.
    try {
      if (filename && !postUpdated) await deleteOriginal(filename);
    } catch (cleanupError) {
      console.error('upload link: could not delete the unused upload', cleanupError);
    }
    try {
      await releaseUploadLink(db, link.id);
    } catch (releaseError) {
      console.error(`upload link ${link.id}: could not release the link after a failed upload`, releaseError);
    }
    // The post was deleted after the claim; its link row went with it (cascade).
    if (error instanceof TRPCError && error.code === 'NOT_FOUND') throw new UploadLinkInvalidError();
    throw error;
  }
  return { ...imageInfo(filename), thumbnailOfPostId: link.thumbnailPostId };
}

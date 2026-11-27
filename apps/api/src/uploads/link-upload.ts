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

/** Reads and discards the rest of the request, so the client gets our response instead of a
 * connection reset while it is still sending. */
function drain(req: IncomingMessage): Promise<void> {
  if (req.readableEnded || req.destroyed) return Promise.resolve();
  return new Promise((resolve) => {
    req.once('end', resolve);
    req.once('close', resolve);
    req.once('error', () => resolve());
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
    let tooLarge = false;
    const cleanup = () => {
      req.off('data', onData);
      req.off('end', onEnd);
      req.off('error', onError);
      req.off('close', onClose);
    };
    const onData = (chunk: Buffer) => {
      if (tooLarge) return; // keep reading (draining) until the client is done
      total += chunk.length;
      if (total > maxBytes) {
        tooLarge = true;
        chunks.length = 0;
      } else {
        chunks.push(chunk);
      }
    };
    const onEnd = () => {
      cleanup();
      if (tooLarge) reject(new ImageTooLargeError());
      else resolve(Buffer.concat(chunks, total));
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
    // Drop a file nothing points to; a thumbnail already set on the post stays.
    if (filename && !postUpdated) await deleteOriginal(filename);
    await releaseUploadLink(db, link.id);
    // The post was deleted after the claim; its link row went with it (cascade).
    if (error instanceof TRPCError && error.code === 'NOT_FOUND') throw new UploadLinkInvalidError();
    throw error;
  }
  return { ...imageInfo(filename), thumbnailOfPostId: link.thumbnailPostId };
}

import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, isNull, lt } from 'drizzle-orm';
import { imageUploadLinks, type Db } from '@carnaby/db';

export const UPLOAD_LINK_TTL_MS = 3_600_000;
const CLEANUP_AFTER_MS = 24 * 3_600_000;

export interface UploadLink {
  id: number;
  createdBy: string | null;
  thumbnailPostId: number | null;
}

const linkColumns = {
  id: imageUploadLinks.id,
  createdBy: imageUploadLinks.createdBy,
  thumbnailPostId: imageUploadLinks.thumbnailPostId,
};

export function hashUploadToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createUploadLink(
  db: Db,
  opts: { createdBy: string | null; thumbnailPostId: number | null },
  now: Date = new Date(),
): Promise<{ token: string; expiresAt: Date }> {
  await db.delete(imageUploadLinks).where(lt(imageUploadLinks.expiresAt, new Date(now.getTime() - CLEANUP_AFTER_MS)));
  const token = randomBytes(32).toString('base64url');
  const expiresAt = new Date(now.getTime() + UPLOAD_LINK_TTL_MS);
  await db.insert(imageUploadLinks).values({
    tokenHash: hashUploadToken(token),
    createdBy: opts.createdBy,
    thumbnailPostId: opts.thumbnailPostId,
    expiresAt,
  });
  return { token, expiresAt };
}

export async function findUsableUploadLink(db: Db, token: string, now: Date = new Date()): Promise<UploadLink | null> {
  const [row] = await db
    .select(linkColumns)
    .from(imageUploadLinks)
    .where(and(
      eq(imageUploadLinks.tokenHash, hashUploadToken(token)),
      isNull(imageUploadLinks.usedAt),
      gt(imageUploadLinks.expiresAt, now),
    ));
  return row ?? null;
}

/** Atomic single-use claim: one UPDATE ... RETURNING, so two concurrent callers cannot both win. */
export async function claimUploadLink(db: Db, token: string, now: Date = new Date()): Promise<UploadLink | null> {
  const [row] = await db
    .update(imageUploadLinks)
    .set({ usedAt: now })
    .where(and(
      eq(imageUploadLinks.tokenHash, hashUploadToken(token)),
      isNull(imageUploadLinks.usedAt),
      gt(imageUploadLinks.expiresAt, now),
    ))
    .returning(linkColumns);
  return row ?? null;
}

export async function releaseUploadLink(db: Db, id: number): Promise<void> {
  await db.update(imageUploadLinks).set({ usedAt: null }).where(eq(imageUploadLinks.id, id));
}

export async function completeUploadLink(db: Db, id: number, filename: string): Promise<void> {
  await db.update(imageUploadLinks).set({ filename }).where(eq(imageUploadLinks.id, id));
}

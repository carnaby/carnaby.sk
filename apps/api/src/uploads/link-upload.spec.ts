import type { Db } from '@carnaby/db';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { savePostChanges } from '../posts/post-changes';
import { receiveLinkUpload } from './link-upload';
import { claimUploadLink, findUsableUploadLink, releaseUploadLink } from './upload-links';
import { deleteOriginal, saveImageBuffer } from './uploads.service';

vi.mock('./upload-links', () => ({
  findUsableUploadLink: vi.fn(),
  claimUploadLink: vi.fn(),
  completeUploadLink: vi.fn(),
  releaseUploadLink: vi.fn(),
}));
vi.mock('./uploads.service', () => ({ saveImageBuffer: vi.fn(), deleteOriginal: vi.fn() }));
vi.mock('../posts/post-changes', () => ({ savePostChanges: vi.fn() }));

const TOKEN = 'secret-token-value';
const db = {} as Db;
const link = { id: 7, createdBy: null, thumbnailPostId: 3 };

describe('receiveLinkUpload cleanup after a failed upload', () => {
  afterEach(() => vi.restoreAllMocks());

  it('rethrows the original error when releasing the link fails, and logs without the token', async () => {
    vi.mocked(findUsableUploadLink).mockResolvedValue(link);
    vi.mocked(claimUploadLink).mockResolvedValue(link);
    vi.mocked(saveImageBuffer).mockResolvedValue('thumb-x.png');
    const original = new Error('post save failed');
    vi.mocked(savePostChanges).mockRejectedValue(original);
    vi.mocked(deleteOriginal).mockRejectedValue(new Error('disk gone'));
    vi.mocked(releaseUploadLink).mockRejectedValue(new Error('db gone'));
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await expect(receiveLinkUpload(db, TOKEN, async () => Buffer.from('img'))).rejects.toBe(original);
    expect(releaseUploadLink).toHaveBeenCalledWith(db, link.id);
    expect(log).toHaveBeenCalled();
    expect(JSON.stringify(log.mock.calls.map((args) => args.map(String)))).not.toContain(TOKEN);
  });
});

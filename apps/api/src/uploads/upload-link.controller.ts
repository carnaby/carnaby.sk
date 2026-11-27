import type { Db } from '@carnaby/db';
import { BadRequestException, Controller, Inject, NotFoundException, Param, PayloadTooLargeException, Put, Req } from '@nestjs/common';
import type { Request } from 'express';
import { DB } from '../db/db.module';
import { ImageTooLargeError, readBodyCapped, receiveLinkUpload, UploadLinkInvalidError, type LinkUploadResult } from './link-upload';
import { InvalidImageError, MAX_IMAGE_BYTES } from './uploads.service';

/**
 * One-time image upload link (MCP `create_image_upload`): `curl -T image.png <link>`.
 * No session or guard -- the unguessable, single-use, one-hour token in the path is the credential.
 * The raw body reaches this handler unread: the global JSON parser skips non-JSON requests.
 */
@Controller('api/uploads/link')
export class UploadLinkController {
  constructor(@Inject(DB) private readonly db: Db) {}

  @Put(':token')
  async upload(@Param('token') token: string, @Req() req: Request): Promise<LinkUploadResult> {
    try {
      return await receiveLinkUpload(this.db, token, () => readBodyCapped(req, MAX_IMAGE_BYTES));
    } catch (error) {
      if (error instanceof UploadLinkInvalidError) throw new NotFoundException(error.message);
      if (error instanceof ImageTooLargeError) throw new PayloadTooLargeException(error.message);
      if (error instanceof InvalidImageError) throw new BadRequestException(error.message);
      throw error;
    }
  }
}

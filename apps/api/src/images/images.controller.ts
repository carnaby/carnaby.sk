import { Controller, Get, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { ImagesService } from './images.service';

const ONE_MONTH_SECONDS = 60 * 60 * 24 * 30;

// Deliberately not under the `api/` prefix: this preserves the v1 site's public URL contract
// (`/images/:width/:filename`) for SEO and for markdown migrated from v1. Next.js rewrites
// /images/* to this app.
@Controller('images')
export class ImagesController {
  constructor(private readonly images: ImagesService) {}

  @Get(':width/:filename')
  async serve(
    @Param('width') widthParam: string,
    @Param('filename') filename: string,
    @Res() res: Response,
  ): Promise<void> {
    const width = Number(widthParam);
    const cachedPath = await this.images.getOrCreate(width, filename);
    res.set({
      'Content-Type': 'image/webp',
      'Cache-Control': `public, max-age=${ONE_MONTH_SECONDS}, immutable`,
    });
    // dotfiles: 'allow' — CACHE_DIR defaults to './.data/cache', and express's `send` middleware
    // otherwise treats the `.data` path segment as hidden and 404s even though the file exists.
    res.sendFile(cachedPath, { dotfiles: 'allow' });
  }
}

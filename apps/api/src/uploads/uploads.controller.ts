import { BadRequestException, Body, Controller, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AdminGuard } from './admin.guard';
import { UnsupportedMimeTypeError, UploadsService } from './uploads.service';

const MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024;
const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{6,20}$/;

@Controller('api/uploads')
@UseGuards(AdminGuard)
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post('thumbnail')
  @UseInterceptors(FileInterceptor('thumbnail', { storage: memoryStorage(), limits: { fileSize: MAX_THUMBNAIL_BYTES } }))
  async uploadThumbnail(@UploadedFile() file?: Express.Multer.File): Promise<{ filename: string }> {
    if (!file) throw new BadRequestException('thumbnail file is required');
    try {
      const filename = await this.uploads.saveThumbnail(file.buffer, file.mimetype);
      return { filename };
    } catch (error) {
      if (error instanceof UnsupportedMimeTypeError) throw new BadRequestException(error.message);
      throw error;
    }
  }

  @Post('from-youtube')
  async fromYoutube(@Body('youtubeId') youtubeId?: string): Promise<{ filename: string }> {
    if (!youtubeId || !YOUTUBE_ID_PATTERN.test(youtubeId)) throw new BadRequestException('invalid youtubeId');
    const filename = await this.uploads.fetchYoutubeThumbnail(youtubeId);
    return { filename };
  }
}

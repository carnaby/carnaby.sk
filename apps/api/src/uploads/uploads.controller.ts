import {
  ArgumentsHost,
  BadGatewayException,
  BadRequestException,
  Body,
  Catch,
  Controller,
  ExceptionFilter,
  Post,
  UploadedFile,
  UseFilters,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage, MulterError } from 'multer';
import { Response } from 'express';
import { AdminGuard } from './admin.guard';
import {
  UnsupportedMimeTypeError,
  UpstreamNotFoundError,
  UpstreamUnavailableError,
  UploadsService,
} from './uploads.service';

const MAX_THUMBNAIL_BYTES = 5 * 1024 * 1024;
const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{6,20}$/;

@Catch(MulterError)
export class MulterErrorFilter implements ExceptionFilter {
  catch(exception: MulterError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    let message = 'invalid upload';

    if (exception.code === 'LIMIT_FILE_SIZE') {
      message = `file too large (max ${MAX_THUMBNAIL_BYTES / 1024 / 1024}MB)`;
    }

    res.status(400).json({
      statusCode: 400,
      message,
      error: 'Bad Request',
    });
  }
}

@Controller('api/uploads')
@UseGuards(AdminGuard)
@UseFilters(MulterErrorFilter)
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
    try {
      const filename = await this.uploads.fetchYoutubeThumbnail(youtubeId);
      return { filename };
    } catch (error) {
      if (error instanceof UpstreamNotFoundError) {
        throw new BadRequestException('youtube thumbnail not found');
      }
      if (error instanceof UpstreamUnavailableError) {
        throw new BadGatewayException('youtube fetch failed');
      }
      throw error;
    }
  }
}

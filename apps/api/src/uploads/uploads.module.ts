import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminGuard } from './admin.guard';
import { UploadLinkController } from './upload-link.controller';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  imports: [AuthModule],
  controllers: [UploadsController, UploadLinkController],
  providers: [UploadsService, AdminGuard],
  exports: [UploadsService],
})
export class UploadsModule {}

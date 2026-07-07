import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdminGuard } from './admin.guard';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  imports: [AuthModule],
  controllers: [UploadsController],
  providers: [UploadsService, AdminGuard],
  exports: [UploadsService],
})
export class UploadsModule {}

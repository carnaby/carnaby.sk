import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DbModule } from '../db/db.module';
import { HealthController } from '../health/health.controller';
import { TrpcModule } from '../trpc/trpc.module';
import { UploadsModule } from '../uploads/uploads.module';

@Module({
  imports: [DbModule, AuthModule, TrpcModule, UploadsModule],
  controllers: [HealthController],
})
export class AppModule {}

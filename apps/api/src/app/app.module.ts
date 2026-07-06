import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DbModule } from '../db/db.module';
import { HealthController } from '../health/health.controller';
import { TrpcModule } from '../trpc/trpc.module';

@Module({
  imports: [DbModule, AuthModule, TrpcModule],
  controllers: [HealthController],
})
export class AppModule {}

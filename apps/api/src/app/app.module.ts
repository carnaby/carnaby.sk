import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DbModule } from '../db/db.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [DbModule, AuthModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}

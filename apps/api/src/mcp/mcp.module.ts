import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { McpController } from './mcp.controller';

@Module({
  imports: [AuthModule],
  controllers: [McpController],
})
export class McpModule {}

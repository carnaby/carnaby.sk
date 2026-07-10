import 'dotenv/config';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { createDb } from '@carnaby/db';
import { NestFactory } from '@nestjs/core';
import { toNodeHandler } from 'better-auth/node';
import * as express from 'express';
import { join } from 'node:path';
import { AppModule } from './app/app.module';
import type { Auth } from './auth/auth';
import { AUTH } from './auth/auth.module';
import { assertProductionEnv } from './env-assert';

async function bootstrap() {
  assertProductionEnv(process.env);
  const migrationsFolder = process.env.MIGRATIONS_DIR ?? join(__dirname, '..', '..', '..', 'packages', 'db', 'migrations');
  const { db, pool } = createDb(process.env.DATABASE_URL!);
  await migrate(db, { migrationsFolder });
  await pool.end();

  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const server = app.getHttpAdapter().getInstance();
  const auth = app.get<Auth>(AUTH);
  server.all('/api/auth/*splat', toNodeHandler(auth));
  server.use(express.json({ limit: '1mb' }));
  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();

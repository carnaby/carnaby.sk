import { Module } from '@nestjs/common';
import { DB } from '../db/db.module';
import { createAuth } from './auth';

export const AUTH = Symbol('AUTH');

@Module({
  providers: [{ provide: AUTH, useFactory: (db) => createAuth(db), inject: [DB] }],
  exports: [AUTH],
})
export class AuthModule {}

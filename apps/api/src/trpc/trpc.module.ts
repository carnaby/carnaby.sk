import type { Db } from '@carnaby/db';
import { Inject, Module, type MiddlewareConsumer, type NestModule } from '@nestjs/common';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import type { Auth } from '../auth/auth';
import { AUTH, AuthModule } from '../auth/auth.module';
import { DB } from '../db/db.module';
import { appRouter } from './app-router';
import { createContext } from './context';

@Module({ imports: [AuthModule] })
export class TrpcModule implements NestModule {
  constructor(@Inject(DB) private db: Db, @Inject(AUTH) private auth: Auth) {}
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(createExpressMiddleware({
        router: appRouter,
        createContext: ({ req }) => createContext({ req, db: this.db, auth: this.auth }),
      }))
      .forRoutes('/trpc');
  }
}

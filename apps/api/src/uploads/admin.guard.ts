import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { fromNodeHeaders } from 'better-auth/node';
import type { Request } from 'express';
import type { Auth } from '../auth/auth';
import { AUTH } from '../auth/auth.module';

/** Mirrors the tRPC `adminProcedure` semantics (apps/api/src/trpc/trpc.ts): 401 when there's no
 * session, 403 when the session's user isn't role `admin`. Session resolution failures (e.g. the
 * auth backend is briefly unreachable) degrade to "no session" rather than throwing 500s. */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(@Inject(AUTH) private readonly auth: Auth) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    let session;
    try {
      session = await this.auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    } catch {
      session = null;
    }
    if (!session?.user) throw new UnauthorizedException();
    if (session.user.role !== 'admin') throw new ForbiddenException();
    return true;
  }
}

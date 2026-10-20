import { createHash } from "node:crypto";
import { ExecutionContext, Injectable, NotFoundException, ServiceUnavailableException, UnauthorizedException, HttpException } from "@nestjs/common";
import { PATH_METADATA } from "@nestjs/common/constants.js";
import { ThrottlerGuard } from "@nestjs/throttler";
import { Redis } from "ioredis";
import { verifyInvitationProxy } from "@semse/auth/invitation-proxy";

@Injectable()
export class InvitationThrottlerGuard extends ThrottlerGuard {
  private invitationRedis?: Redis;
  private invitationConnect?: Promise<void>;

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ url: string; method: string; headers: Record<string, unknown>; ip?: string }>();
    // Bind to matched Nest route metadata, not attacker-controlled URL spelling.
    const controllerPath = Reflect.getMetadata(PATH_METADATA, context.getClass());
    const action = Reflect.getMetadata(PATH_METADATA, context.getHandler());
    if (controllerPath !== "v1/invitations" || !["preview", "accept", "register"].includes(action)) return super.canActivate(context);
    const path = `/v1/invitations/${action}`;
    if (process.env.SEMSE_ORG_INVITATIONS_ENABLED !== "true" || (path.endsWith("/register") &&
        (process.env.SEMSE_INVITATION_EMAIL_DELIVERY !== "true" || process.env.SEMSE_INVITED_REGISTRATION_ENABLED !== "true"))) throw new NotFoundException();
    const key = process.env.SEMSE_INVITATION_PROXY_KEY ?? "";
    // No untrusted forwarded headers. Production transport requires the authenticated BFF hop.
    const ip = verifyInvitationProxy(key, req.headers, req.method, path);
    if (!ip && process.env.NODE_ENV === "production") throw new UnauthorizedException("Invitation proxy assertion required");
    const identity = ip ?? req.ip;
    if (!identity || !process.env.REDIS_URL) throw new ServiceUnavailableException("Invitation rate limit unavailable");
    if (!this.invitationRedis) {
      this.invitationRedis = new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1, connectTimeout: 1000, commandTimeout: 1000, enableOfflineQueue: false });
      this.invitationRedis.on("error", () => { /* No connection URLs or credentials in logs. */ });
    }
    try {
      if (this.invitationRedis.status !== "ready") {
        // Share the cold-start handshake. Concurrent callers must not EVAL while
        // the socket is still connecting and enableOfflineQueue is disabled.
        if (!this.invitationConnect && this.invitationRedis.status === "wait") {
          this.invitationConnect = this.invitationRedis.connect().finally(() => { this.invitationConnect = undefined; });
        }
        if (this.invitationConnect) await this.invitationConnect;
        if ((this.invitationRedis as Redis).status !== "ready") throw new ServiceUnavailableException("Invitation rate limit unavailable");
      }
      const bucket = "invitation:" + createHash("sha256").update(path + "\n" + identity).digest("hex");
      const count = Number(await this.invitationRedis.eval("local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('PEXPIRE',KEYS[1],ARGV[1]) end; return n", 1, bucket, 60000));
      if (count > (path.endsWith("/register") ? 5 : 10)) throw new HttpException("Too many requests", 429);
      return true;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new ServiceUnavailableException("Invitation rate limit unavailable");
    }
  }

  async onModuleDestroy(): Promise<void> { this.invitationRedis?.disconnect(); }
}

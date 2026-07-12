import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { JwtPayload } from '../../common/decorators/current-user.decorator';
import { getMetaConfig } from './meta.config';

@Injectable()
export class MetaConfigGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    if (getMetaConfig(this.config)) {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();
    const isCallback = req.path.endsWith('/callback');

    throw new ServiceUnavailableException(
      isCallback
        ? 'Instagram OAuth is not configured on the server.'
        : 'Instagram OAuth is not configured. Set META_APP_ID, META_APP_SECRET, and META_REDIRECT_URI.',
    );
  }
}

@Injectable()
export class InstagramAuthGuard extends AuthGuard('jwt') {
  constructor(
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
  ) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
    const queryToken =
      typeof req.query.token === 'string' ? req.query.token.trim() : undefined;

    if (queryToken) {
      try {
        const payload = this.jwtService.verify<JwtPayload>(queryToken, {
          secret: this.config.getOrThrow<string>('JWT_SECRET'),
        });
        req.user = payload;
        return true;
      } catch {
        throw new UnauthorizedException('Invalid or expired token');
      }
    }

    const result = await super.canActivate(context);
    return Boolean(result);
  }
}

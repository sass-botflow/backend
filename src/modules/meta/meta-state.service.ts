import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

export interface MetaOAuthStatePayload {
  workspaceId: string;
  purpose: 'meta_embedded_signup';
}

@Injectable()
export class MetaStateService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  create(workspaceId: string): string {
    return this.jwt.sign(
      { workspaceId, purpose: 'meta_embedded_signup' } satisfies MetaOAuthStatePayload,
      {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
        expiresIn: '15m',
      },
    );
  }

  verify(state: string): MetaOAuthStatePayload {
    try {
      const payload = this.jwt.verify<MetaOAuthStatePayload>(state, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
      });

      if (payload.purpose !== 'meta_embedded_signup' || !payload.workspaceId) {
        throw new UnauthorizedException('Invalid OAuth state');
      }

      return payload;
    } catch {
      throw new UnauthorizedException('Invalid or expired OAuth state');
    }
  }
}

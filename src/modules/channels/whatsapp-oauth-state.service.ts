import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

export interface WhatsAppOAuthStatePayload {
  workspaceId: string;
  userId: string;
  purpose: 'whatsapp_embedded_signup';
}

@Injectable()
export class WhatsAppOAuthStateService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  create(workspaceId: string, userId: string): string {
    return this.jwt.sign(
      { workspaceId, userId, purpose: 'whatsapp_embedded_signup' } satisfies WhatsAppOAuthStatePayload,
      {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
        expiresIn: '15m',
      },
    );
  }

  verify(state: string): WhatsAppOAuthStatePayload {
    try {
      const payload = this.jwt.verify<WhatsAppOAuthStatePayload>(state, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
      });

      if (payload.purpose !== 'whatsapp_embedded_signup' || !payload.workspaceId) {
        throw new UnauthorizedException('Invalid OAuth state');
      }

      return payload;
    } catch {
      throw new UnauthorizedException('Invalid or expired OAuth state');
    }
  }
}

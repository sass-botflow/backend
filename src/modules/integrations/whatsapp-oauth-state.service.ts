import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

export interface WhatsAppOAuthState {
  sub: string;
  organizationId: string;
  purpose: 'whatsapp_oauth';
}

@Injectable()
export class WhatsAppOAuthStateService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  createState(userId: string, organizationId: string): string {
    return this.jwt.sign(
      { sub: userId, organizationId, purpose: 'whatsapp_oauth' },
      {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
        expiresIn: '10m',
      },
    );
  }

  verifyState(state: string): WhatsAppOAuthState {
    try {
      const payload = this.jwt.verify<WhatsAppOAuthState>(state, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
      });

      if (payload.purpose !== 'whatsapp_oauth' || !payload.organizationId) {
        throw new UnauthorizedException('Invalid OAuth state');
      }

      return payload;
    } catch {
      throw new UnauthorizedException('Invalid or expired OAuth state');
    }
  }
}

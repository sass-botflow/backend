import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

@Injectable()
export class TokenEncryptionService {
  private readonly logger = new Logger(TokenEncryptionService.name);
  private key: Buffer | null = null;
  private readonly keyConfigured: boolean;

  constructor(private readonly config: ConfigService) {
    const raw = this.config.get<string>('TOKEN_ENCRYPTION_KEY');
    this.keyConfigured = Boolean(raw?.trim());

    if (!this.keyConfigured) {
      this.logger.warn(
        'TOKEN_ENCRYPTION_KEY is not set — token encryption is disabled',
      );
      return;
    }

    this.key = this.parseKey(raw!);
  }

  isConfigured(): boolean {
    return this.key !== null;
  }

  encrypt(plaintext: string): string {
    const key = this.requireKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return `v1:${iv.toString('base64url')}:${tag.toString('base64url')}:${encrypted.toString('base64url')}`;
  }

  decrypt(payload: string): string {
    const key = this.requireKey();
    const parts = payload.split(':');
    if (parts.length !== 4 || parts[0] !== 'v1') {
      throw new InternalServerErrorException('Invalid encrypted token format');
    }

    const [, ivB64, tagB64, dataB64] = parts;
    const iv = Buffer.from(ivB64, 'base64url');
    const tag = Buffer.from(tagB64, 'base64url');
    const data = Buffer.from(dataB64, 'base64url');

    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
    return decrypted.toString('utf8');
  }

  private requireKey(): Buffer {
    if (!this.key) {
      throw new InternalServerErrorException(
        'TOKEN_ENCRYPTION_KEY is not configured — required for WhatsApp channel operations',
      );
    }
    return this.key;
  }

  private parseKey(raw: string): Buffer {
    if (/^[0-9a-fA-F]{64}$/.test(raw)) {
      return Buffer.from(raw, 'hex');
    }

    const decoded = Buffer.from(raw, 'base64');
    if (decoded.length === 32) {
      return decoded;
    }

    throw new InternalServerErrorException(
      'TOKEN_ENCRYPTION_KEY must be 32 bytes (64-char hex or base64)',
    );
  }
}

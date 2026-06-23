import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class RedisService {
  private client: import('ioredis').default | null = null;

  constructor(private readonly config: ConfigService) {}

  async getClient() {
    if (!this.client) {
      const Redis = (await import('ioredis')).default;
      const url = this.config.get<string>('REDIS_URL');
      this.client = url ? new Redis(url) : new Redis();
    }
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    const client = await this.getClient();
    return client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    const client = await this.getClient();
    if (ttlSeconds) {
      await client.set(key, value, 'EX', ttlSeconds);
    } else {
      await client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    const client = await this.getClient();
    await client.del(key);
  }
}

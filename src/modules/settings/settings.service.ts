import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  getBranding(organizationId: string) {
    return this.prisma.brandingSettings.findUnique({ where: { organizationId } });
  }

  updateBranding(
    organizationId: string,
    data: { primaryColor?: string; accentColor?: string; customDomain?: string; whiteLabel?: boolean },
  ) {
    return this.prisma.brandingSettings.upsert({
      where: { organizationId },
      create: { organizationId, ...data },
      update: data,
    });
  }

  listApiKeys(organizationId: string) {
    return this.prisma.apiKey.findMany({
      where: { organizationId },
      select: { id: true, name: true, prefix: true, lastUsedAt: true, createdAt: true },
    });
  }

  async createApiKey(organizationId: string, name: string) {
    const raw = `bf_${randomBytes(24).toString('hex')}`;
    const prefix = raw.slice(0, 10);
    const keyHash = createHash('sha256').update(raw).digest('hex');

    await this.prisma.apiKey.create({
      data: { name, prefix, keyHash, organizationId },
    });

    return { key: raw, prefix };
  }
}

import { Injectable } from '@nestjs/common';
import { ChannelType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class IntegrationsService {
  constructor(private readonly prisma: PrismaService) {}

  listChannels(organizationId: string) {
    return this.prisma.channelConnection.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
  }

  connectChannel(organizationId: string, data: { type: ChannelType; name: string }) {
    return this.prisma.channelConnection.create({
      data: {
        type: data.type,
        name: data.name,
        organizationId,
        status: 'PENDING',
      },
    });
  }

  listIntegrations(organizationId: string) {
    return this.prisma.integration.findMany({
      where: { organizationId },
    });
  }
}

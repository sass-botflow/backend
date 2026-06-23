import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCurrent(organizationId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        subscription: true,
        branding: true,
        _count: { select: { members: true, contacts: true, bots: true } },
      },
    });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async getMembers(organizationId: string) {
    return this.prisma.organizationMember.findMany({
      where: { organizationId },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    });
  }
}

import { Injectable } from '@nestjs/common';
import { ContactSource } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class CrmService {
  constructor(private readonly prisma: PrismaService) {}

  listContacts(organizationId: string, search?: string) {
    return this.prisma.contact.findMany({
      where: {
        organizationId,
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search } },
          ],
        }),
      },
      include: { tags: true, deals: { include: { stage: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  createContact(
    organizationId: string,
    data: { name: string; email?: string; phone?: string; source?: ContactSource },
  ) {
    return this.prisma.contact.create({
      data: { ...data, organizationId },
      include: { tags: true },
    });
  }

  listPipelines(organizationId: string) {
    return this.prisma.pipeline.findMany({
      where: { organizationId },
      include: { stages: { include: { deals: { include: { contact: true } } }, orderBy: { order: 'asc' } } },
    });
  }

  createPipeline(organizationId: string, data: { name: string; stages: string[] }) {
    return this.prisma.pipeline.create({
      data: {
        name: data.name,
        organizationId,
        stages: {
          create: data.stages.map((name, order) => ({ name, order })),
        },
      },
      include: { stages: true },
    });
  }

  moveDeal(dealId: string, stageId: string) {
    return this.prisma.deal.update({
      where: { id: dealId },
      data: { stageId },
      include: { stage: true, contact: true },
    });
  }
}

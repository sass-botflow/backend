import { Injectable } from '@nestjs/common';
import { DocumentType } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class KnowledgeService {
  constructor(private readonly prisma: PrismaService) {}

  list(organizationId: string) {
    return this.prisma.knowledgeBase.findMany({
      where: { organizationId },
      include: { documents: true },
      orderBy: { updatedAt: 'desc' },
    });
  }

  create(organizationId: string, data: { name: string; description?: string }) {
    return this.prisma.knowledgeBase.create({
      data: { ...data, organizationId },
    });
  }

  addDocument(
    knowledgeBaseId: string,
    data: { title: string; type: DocumentType; sourceUrl?: string; content?: string },
  ) {
    return this.prisma.knowledgeDocument.create({
      data: { ...data, knowledgeBaseId, status: 'PENDING' },
    });
  }
}

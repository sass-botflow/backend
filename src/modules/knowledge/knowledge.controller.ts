import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { DocumentType } from '@prisma/client';
import { KnowledgeService } from './knowledge.service';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('knowledge')
@Controller('api/knowledge')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class KnowledgeController {
  constructor(private readonly service: KnowledgeService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.service.list(user.organizationId!);
  }

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() body: { name: string; description?: string }) {
    return this.service.create(user.organizationId!, body);
  }

  @Post(':id/documents')
  addDocument(
    @Param('id') id: string,
    @Body() body: { title: string; type: DocumentType; sourceUrl?: string; content?: string },
  ) {
    return this.service.addDocument(id, body);
  }
}

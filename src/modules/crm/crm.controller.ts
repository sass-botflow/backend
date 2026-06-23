import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ContactSource } from '@prisma/client';
import { CrmService } from './crm.service';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('crm')
@Controller('api/crm')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class CrmController {
  constructor(private readonly service: CrmService) {}

  @Get('contacts')
  list(@CurrentUser() user: JwtPayload, @Query('search') search?: string) {
    return this.service.listContacts(user.organizationId!, search);
  }

  @Post('contacts')
  create(
    @CurrentUser() user: JwtPayload,
    @Body() body: { name: string; email?: string; phone?: string; source?: ContactSource },
  ) {
    return this.service.createContact(user.organizationId!, body);
  }

  @Get('pipelines')
  pipelines(@CurrentUser() user: JwtPayload) {
    return this.service.listPipelines(user.organizationId!);
  }

  @Post('pipelines')
  createPipeline(
    @CurrentUser() user: JwtPayload,
    @Body() body: { name: string; stages: string[] },
  ) {
    return this.service.createPipeline(user.organizationId!, body);
  }

  @Patch('deals/:id/stage')
  moveDeal(@Param('id') id: string, @Body('stageId') stageId: string) {
    return this.service.moveDeal(id, stageId);
  }
}

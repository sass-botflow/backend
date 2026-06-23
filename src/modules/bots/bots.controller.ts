import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BotStatus, WorkflowNodeType } from '@prisma/client';
import { BotsService } from './bots.service';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('bots')
@Controller('api/bots')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class BotsController {
  constructor(private readonly service: BotsService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.service.list(user.organizationId!);
  }

  @Post()
  create(
    @CurrentUser() user: JwtPayload,
    @Body() body: { name: string; description?: string },
  ) {
    return this.service.create(user.organizationId!, body);
  }

  @Get(':id')
  get(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.service.get(user.organizationId!, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string; status?: BotStatus },
  ) {
    return this.service.update(user.organizationId!, id, body);
  }

  @Delete(':id')
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.service.remove(user.organizationId!, id);
  }

  @Post(':id/nodes')
  addNode(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: { type: WorkflowNodeType; label: string; config?: object; position?: object },
  ) {
    return this.service.addNode(user.organizationId!, id, body);
  }

  @Post(':id/edges')
  addEdge(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: { sourceId: string; targetId: string; condition?: string },
  ) {
    return this.service.addEdge(user.organizationId!, id, body);
  }
}

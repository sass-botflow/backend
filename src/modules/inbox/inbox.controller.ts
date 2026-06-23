import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ConversationStatus } from '@prisma/client';
import { InboxService } from './inbox.service';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('inbox')
@Controller('api/inbox')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class InboxController {
  constructor(private readonly service: InboxService) {}

  @Get('conversations')
  list(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: ConversationStatus,
  ) {
    return this.service.listConversations(user.organizationId!, status);
  }

  @Get('conversations/:id')
  get(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.service.getConversation(user.organizationId!, id);
  }

  @Post('conversations/:id/messages')
  sendMessage(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body('content') content: string,
  ) {
    return this.service.sendMessage(user.organizationId!, id, content);
  }

  @Patch('conversations/:id/assign')
  assign(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body('agentId') agentId: string,
  ) {
    return this.service.assignConversation(user.organizationId!, id, agentId);
  }

  @Post('conversations/:id/notes')
  addNote(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body('content') content: string,
  ) {
    return this.service.addNote(user.organizationId!, id, user.sub, content);
  }
}

import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ChannelType } from '@prisma/client';
import { IntegrationsService } from './integrations.service';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('integrations')
@Controller('api/integrations')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class IntegrationsController {
  constructor(private readonly service: IntegrationsService) {}

  @Get('channels')
  channels(@CurrentUser() user: JwtPayload) {
    return this.service.listChannels(user.organizationId!);
  }

  @Post('channels')
  connectChannel(
    @CurrentUser() user: JwtPayload,
    @Body() body: { type: ChannelType; name: string },
  ) {
    return this.service.connectChannel(user.organizationId!, body);
  }

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.service.listIntegrations(user.organizationId!);
  }
}

import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { WhatsAppEvolutionService } from '../whatsapp/whatsapp-evolution.service';

@ApiTags('channels')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('api/channels')
export class ChannelsController {
  constructor(private readonly whatsapp: WhatsAppEvolutionService) {}

  @Get()
  listChannels(@CurrentUser() user: JwtPayload) {
    return this.whatsapp.listChannelsForUser(user.sub);
  }
}

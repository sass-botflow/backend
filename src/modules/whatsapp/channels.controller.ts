import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { InstagramAuthService } from '../instagram/instagram-auth.service';
import { WhatsAppEvolutionService } from './whatsapp-evolution.service';

@ApiTags('channels')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('api/channels')
export class ChannelsController {
  constructor(
    private readonly whatsapp: WhatsAppEvolutionService,
    private readonly instagram: InstagramAuthService,
  ) {}

  @Get()
  async listChannels(@CurrentUser() user: JwtPayload) {
    const [whatsapp, instagram] = await Promise.all([
      this.whatsapp.listChannelsForUser(user.sub),
      this.instagram.getConnectionForUser(user.sub),
    ]);

    const channels = [...whatsapp.channels];
    if (instagram) {
      channels.push({
        id: instagram.id,
        provider: 'instagram',
        status: instagram.status,
        displayPhoneNumber: instagram.displayPhoneNumber,
        businessName: instagram.businessName,
        connectedAt: instagram.connectedAt,
        updatedAt: instagram.updatedAt,
        phoneNumberId: instagram.instagramUserId,
        avatarUrl: instagram.avatarUrl,
        username: instagram.username,
      });
    }

    return { channels };
  }
}

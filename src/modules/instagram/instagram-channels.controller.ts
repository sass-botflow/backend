import { Controller, Delete, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { InstagramAuthService } from './instagram-auth.service';

@ApiTags('channels')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('api/channels/instagram')
export class InstagramChannelsController {
  constructor(private readonly instagram: InstagramAuthService) {}

  @Get()
  async getConnection(@CurrentUser() user: JwtPayload) {
    const connection = await this.instagram.getConnectionForUser(user.sub);
    return { connected: Boolean(connection), channel: connection };
  }

  @Delete()
  async disconnect(@CurrentUser() user: JwtPayload) {
    await this.instagram.disconnect(user.sub);
    return { success: true };
  }
}

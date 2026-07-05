import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { CreateWhatsAppSessionDto } from './dto/create-whatsapp-session.dto';
import { WhatsAppSessionEntity } from './entities/whatsapp-session.entity';
import { WhatsAppService } from './whatsapp.service';

@ApiTags('whatsapp')
@Controller('api/whatsapp')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class WhatsAppController {
  constructor(private readonly whatsappService: WhatsAppService) {}

  @Post('sessions')
  createSession(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateWhatsAppSessionDto,
  ): Promise<WhatsAppSessionEntity> {
    return this.whatsappService.createSession(user.sub, user.organizationId, dto);
  }
}

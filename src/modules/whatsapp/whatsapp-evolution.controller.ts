import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { SendWhatsAppMessageDto } from './dto/send-whatsapp-message.dto';
import { WhatsAppEvolutionService } from './whatsapp-evolution.service';

@ApiTags('channels')
@ApiBearerAuth()
@UseGuards(AuthGuard('jwt'))
@Controller('api/channels/whatsapp')
export class WhatsAppEvolutionController {
  constructor(private readonly whatsapp: WhatsAppEvolutionService) {}

  @Post('connect')
  connect(@CurrentUser() user: JwtPayload) {
    return this.whatsapp.connect(user.sub);
  }

  @Post('create-session')
  createSession(@CurrentUser() user: JwtPayload) {
    return this.whatsapp.connect(user.sub);
  }

  @Get('session')
  getSession(@CurrentUser() user: JwtPayload) {
    return this.whatsapp.getSessionForUser(user.sub);
  }

  @Post('send')
  sendMessage(@CurrentUser() user: JwtPayload, @Body() body: SendWhatsAppMessageDto) {
    return this.whatsapp.sendMessageForUser(user.sub, body);
  }

  @Get(':id/qr')
  getQr(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.whatsapp.getQrCode(user.sub, id);
  }

  @Get(':id/status')
  getStatus(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.whatsapp.getStatus(user.sub, id);
  }

  @Post(':id/send')
  sendMessageForInstance(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() body: SendWhatsAppMessageDto,
  ) {
    return this.whatsapp.sendMessage(user.sub, id, body);
  }

  @Delete(':id')
  deleteSession(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.whatsapp.deleteSession(user.sub, id);
  }
}

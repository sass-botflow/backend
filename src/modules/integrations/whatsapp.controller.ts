import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { ConnectWhatsAppDto, UpdateWhatsAppDto } from './dto/whatsapp.dto';
import { WhatsAppService } from './whatsapp.service';

@ApiTags('integrations')
@Controller('api/integrations/whatsapp')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class WhatsAppController {
  constructor(private readonly whatsappService: WhatsAppService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.whatsappService.listAccounts(user.organizationId!);
  }

  @Post()
  connect(@CurrentUser() user: JwtPayload, @Body() dto: ConnectWhatsAppDto) {
    return this.whatsappService.connectAccount(user.organizationId!, dto);
  }

  @Get(':id')
  get(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.whatsappService.getAccount(user.organizationId!, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateWhatsAppDto,
  ) {
    return this.whatsappService.updateAccount(user.organizationId!, id, dto);
  }

  @Post(':id/disconnect')
  disconnect(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.whatsappService.disconnectAccount(user.organizationId!, id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.whatsappService.removeAccount(user.organizationId!, id);
  }
}

import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { CreateWhatsAppSessionDto } from './dto/create-whatsapp-session.dto';
import { WhatsAppSessionIdParam } from './dto/whatsapp-session-id.param';
import {
  WhatsAppSessionItemResponseDto,
  WhatsAppSessionResponseDto,
  WhatsAppSessionsListResponseDto,
} from './dto/whatsapp-session-response.dto';
import { WhatsAppService } from './whatsapp.service';

@ApiTags('whatsapp')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing or invalid JWT' })
@Controller('api/whatsapp')
@UseGuards(AuthGuard('jwt'))
export class WhatsAppController {
  constructor(private readonly whatsappService: WhatsAppService) {}

  @Get('sessions')
  @ApiOperation({ summary: 'List WhatsApp sessions for the current workspace' })
  @ApiOkResponse({ type: WhatsAppSessionsListResponseDto })
  async listSessions(
    @CurrentUser() user: JwtPayload,
  ): Promise<WhatsAppSessionsListResponseDto> {
    const sessions = await this.whatsappService.listSessions(user.sub, user.organizationId);
    return { sessions };
  }

  @Get('sessions/:id')
  @ApiOperation({ summary: 'Get a WhatsApp session by ID' })
  @ApiOkResponse({ type: WhatsAppSessionItemResponseDto })
  @ApiNotFoundResponse({ description: 'Session not found in this workspace' })
  async getSession(
    @CurrentUser() user: JwtPayload,
    @Param() params: WhatsAppSessionIdParam,
  ): Promise<WhatsAppSessionItemResponseDto> {
    const session = await this.whatsappService.getSession(
      user.sub,
      user.organizationId,
      params.id,
    );
    return { session };
  }

  @Post('sessions')
  @ApiOperation({ summary: 'Create a WhatsApp Evolution session' })
  @ApiCreatedResponse({ type: WhatsAppSessionResponseDto })
  createSession(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateWhatsAppSessionDto,
  ): Promise<WhatsAppSessionResponseDto> {
    return this.whatsappService.createSession(user.sub, user.organizationId, dto);
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { ChannelsService } from './channels.service';
import { WhatsAppEmbeddedSignupCompleteDto } from './dto/whatsapp-embedded-signup-complete.dto';
import { EmbeddedSignupCompleteResult } from './embedded-signup.result';

@ApiTags('channels')
@Controller('api/channels')
export class ChannelsController {
  constructor(private readonly channelsService: ChannelsService) {}

  @Get()
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  list(@CurrentUser() user: JwtPayload) {
    return this.channelsService.listChannels(user.organizationId!);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  get(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.channelsService.getChannel(user.organizationId!, id);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.channelsService.deleteChannel(user.organizationId!, id);
  }

  @Post(':id/refresh')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  refresh(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.channelsService.refreshChannel(user.organizationId!, id);
  }

  @Post(':id/disconnect')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  disconnect(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.channelsService.disconnectChannelById(user.organizationId!, id);
  }
}

@ApiTags('channels')
@Controller('api/channels/whatsapp')
export class WhatsAppOAuthController {
  constructor(private readonly channelsService: ChannelsService) {}

  @Get('connect')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  connect(@CurrentUser() user: JwtPayload) {
    return this.channelsService.getEmbeddedSignupConfig(user.sub, user.organizationId);
  }

  @Post('complete')
  @UsePipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )
  complete(@Body() dto: WhatsAppEmbeddedSignupCompleteDto): Promise<EmbeddedSignupCompleteResult> {
    return this.channelsService.completeEmbeddedSignup(dto);
  }

  @Get('callback')
  async callback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Query('error_description') errorDescription: string | undefined,
    @Res() res: Response,
  ) {
    const result = await this.channelsService.handleOAuthCallback(
      code,
      state,
      errorDescription ?? error,
    );

    if (typeof result === 'string') {
      return res.redirect(result);
    }

    const frontendUrl = process.env.FRONTEND_URL ?? 'https://botflow.ink';
    return res.redirect(
      `${frontendUrl}/dashboard/channels?success=true&channelId=${result.channelId}&phoneNumberId=${result.phoneNumberId}`,
    );
  }
}

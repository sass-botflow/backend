import { BadRequestException, Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { WhatsAppService } from './whatsapp.service';

@ApiTags('integrations')
@Controller('api/integrations/whatsapp')
export class WhatsAppController {
  constructor(private readonly whatsappService: WhatsAppService) {}

  @Get('oauth/callback')
  async oauthCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Query('error_description') errorDescription: string | undefined,
    @Res() res: Response,
  ) {
    const redirectUrl = await this.whatsappService.handleOAuthCallback(
      code,
      state,
      errorDescription ?? error,
    );
    return res.redirect(redirectUrl);
  }

  @Get('oauth')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  startOAuth(@CurrentUser() user: JwtPayload, @Res() res: Response) {
    if (!user.organizationId) {
      throw new BadRequestException('No organization context found for this user');
    }

    const url = this.whatsappService.getOAuthUrl(user.sub, user.organizationId);
    return res.redirect(url);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  list(@CurrentUser() user: JwtPayload) {
    return this.whatsappService.listAccounts(user.organizationId!);
  }
}

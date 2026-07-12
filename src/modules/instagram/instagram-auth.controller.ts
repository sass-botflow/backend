import {
  Controller,
  Delete,
  Get,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import { InstagramAuthGuard, MetaConfigGuard } from './guards/instagram-auth.guard';
import { InstagramAuthService } from './instagram-auth.service';
import { MetaGraphService } from './meta-graph.service';
import { renderOAuthErrorPage } from './utils/oauth-error-page';
import { renderOAuthSuccessPage } from './utils/oauth-success-page';

@ApiTags('auth')
@Controller('api/auth')
export class InstagramAuthController {
  constructor(
    private readonly instagramAuth: InstagramAuthService,
    private readonly config: ConfigService,
    private readonly metaGraph: MetaGraphService,
  ) {}

  @Get('instagram')
  @UseGuards(MetaConfigGuard, InstagramAuthGuard)
  @ApiBearerAuth()
  @ApiQuery({ name: 'flow', required: false })
  @ApiQuery({ name: 'popup', required: false, description: 'Open OAuth in popup; returns to BotFlow after connect' })
  startOAuth(
    @CurrentUser() user: JwtPayload,
    @Query('flow') flow: string | undefined,
    @Query('popup') popup: string | undefined,
    @Res() res: Response,
  ): void {
    const usePopup = popup === '1' || popup === 'true';
    const authorizeUrl = this.instagramAuth.getAuthorizeUrl(user.sub, flow, usePopup);
    res.redirect(authorizeUrl);
  }

  @Get('instagram/callback')
  async handleCallback(
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') error: string | undefined,
    @Query('error_description') errorDescription: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'https://www.botflow.ink';

    if (!this.metaGraph.isConfigured()) {
      res
        .status(503)
        .type('html')
        .send(
          renderOAuthErrorPage(
            'Configuration error',
            'Instagram OAuth is not configured. Set META_APP_ID, META_APP_SECRET, and META_REDIRECT_URI.',
            frontendUrl,
          ),
        );
      return;
    }

    if (error) {
      res
        .status(400)
        .type('html')
        .send(
          renderOAuthErrorPage(
            'Instagram connection failed',
            errorDescription ?? 'Instagram authorization was denied or cancelled.',
            frontendUrl,
          ),
        );
      return;
    }

    if (!code?.trim() || !state?.trim()) {
      res
        .status(400)
        .type('html')
        .send(
          renderOAuthErrorPage(
            'Instagram connection failed',
            'Missing authorization code or state. Please try connecting again.',
            frontendUrl,
          ),
        );
      return;
    }

    try {
      const result = await this.instagramAuth.handleCallback(code, state);

      if (result.popup) {
        res
          .status(200)
          .type('html')
          .send(
            renderOAuthSuccessPage({
              frontendUrl,
              username: result.username,
              profilePictureUrl: result.profilePictureUrl,
              popup: true,
            }),
          );
        return;
      }

      res.redirect(
        new URL('/dashboard/channels?instagram=connected', frontendUrl).toString(),
      );
    } catch (err) {
      const mapped = this.instagramAuth.mapError(err);
      res
        .status(mapped.statusCode)
        .type('html')
        .send(
          renderOAuthErrorPage(
            'Instagram connection failed',
            mapped.message,
            frontendUrl,
          ),
        );
    }
  }
}

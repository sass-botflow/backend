import {
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Logger,
  Post,
  Query,
  Body,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { MetaWebhookService } from './meta-webhook.service';

@ApiTags('webhooks')
@Controller('webhooks/meta')
export class MetaWebhookController {
  private readonly logger = new Logger(MetaWebhookController.name);

  constructor(
    private readonly webhookService: MetaWebhookService,
    private readonly config: ConfigService,
  ) {}

  @Get()
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') verifyToken: string,
    @Query('hub.challenge') challenge: string,
    @Res() res: Response,
  ) {
    const expectedToken = this.config.getOrThrow<string>('META_VERIFY_TOKEN');

    if (mode === 'subscribe' && verifyToken === expectedToken) {
      this.logger.log('Meta webhook verified successfully');
      return res.status(200).send(challenge);
    }

    this.logger.warn('Meta webhook verification failed', { mode });
    throw new ForbiddenException('Webhook verification failed');
  }

  @Post()
  @HttpCode(200)
  receive(@Body() body: unknown) {
    void this.webhookService.processWebhookPayload(body).catch((error) => {
      this.logger.error('Unhandled webhook processing error', {
        error: error instanceof Error ? error.message : error,
      });
    });

    return { received: true };
  }
}

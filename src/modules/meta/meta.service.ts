import { BadRequestException, Injectable } from '@nestjs/common';
import { MetaConnectionResult } from './meta.constants';
import { ChannelsService } from '../channels/channels.service';
import { WhatsAppOAuthResult } from '../channels/channels.constants';

@Injectable()
export class MetaService {
  constructor(private readonly channelsService: ChannelsService) {}

  getConnectUrl(userId: string, workspaceId: string | undefined): Promise<string> {
    return this.channelsService.getConnectUrl(userId, workspaceId);
  }

  async handleCallback(
    code: string | undefined,
    state: string | undefined,
  ): Promise<MetaConnectionResult> {
    const result = await this.channelsService.handleOAuthCallback(code, state);

    if (typeof result === 'string') {
      const errorMatch = result.match(/error=([^&]+)/);
      throw new BadRequestException(
        errorMatch?.[1]
          ? decodeURIComponent(errorMatch[1])
          : 'Meta OAuth callback failed',
      );
    }

    return this.toLegacyResult(result);
  }

  private toLegacyResult(result: WhatsAppOAuthResult): MetaConnectionResult {
    return {
      connected: true,
      workspaceId: result.workspaceId,
      phoneNumberId: result.phoneNumberId,
      wabaId: result.wabaId,
    };
  }
}

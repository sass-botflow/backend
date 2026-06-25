import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WhatsAppAccountStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { MetaGraphService } from './meta-graph.service';
import { WhatsAppOAuthStateService } from './whatsapp-oauth-state.service';
import { toPublicAccount } from './whatsapp.constants';

@Injectable()
export class WhatsAppService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metaGraph: MetaGraphService,
    private readonly oauthState: WhatsAppOAuthStateService,
    private readonly config: ConfigService,
  ) {}

  listAccounts(organizationId: string) {
    return this.prisma.whatsAppAccount
      .findMany({
        where: { organizationId },
        orderBy: { createdAt: 'desc' },
      })
      .then((accounts) => accounts.map(toPublicAccount));
  }

  getOAuthUrl(userId: string, organizationId: string): string {
    const state = this.oauthState.createState(userId, organizationId);
    return this.metaGraph.buildOAuthUrl(state);
  }

  async handleOAuthCallback(code: string | undefined, state: string | undefined, error?: string) {
    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'https://botflow.ink';
    const redirectBase = `${frontendUrl}/settings/integrations`;

    if (error) {
      return `${redirectBase}?success=false&error=${encodeURIComponent(error)}`;
    }

    if (!code || !state) {
      return `${redirectBase}?success=false&error=${encodeURIComponent('Missing authorization code or state')}`;
    }

    try {
      const { organizationId } = this.oauthState.verifyState(state);
      const accessToken = await this.metaGraph.exchangeCodeForToken(code);
      const connection = await this.metaGraph.discoverWhatsAppConnection(accessToken);

      await this.prisma.whatsAppAccount.upsert({
        where: {
          organizationId_phoneNumberId: {
            organizationId,
            phoneNumberId: connection.phoneNumberId,
          },
        },
        create: {
          organizationId,
          phoneNumberId: connection.phoneNumberId,
          businessAccountId: connection.businessAccountId,
          accessToken: connection.accessToken,
          status: WhatsAppAccountStatus.CONNECTED,
          connectedAt: new Date(),
        },
        update: {
          businessAccountId: connection.businessAccountId,
          accessToken: connection.accessToken,
          status: WhatsAppAccountStatus.CONNECTED,
          connectedAt: new Date(),
        },
      });

      return `${redirectBase}?success=true`;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'OAuth connection failed';
      return `${redirectBase}?success=false&error=${encodeURIComponent(message)}`;
    }
  }
}

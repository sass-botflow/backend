import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { WhatsAppAccountStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ConnectWhatsAppDto, UpdateWhatsAppDto } from './dto/whatsapp.dto';
import { toPublicAccount } from './whatsapp.utils';

@Injectable()
export class WhatsAppService {
  constructor(private readonly prisma: PrismaService) {}

  async listAccounts(organizationId: string) {
    const accounts = await this.prisma.whatsAppAccount.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });

    return accounts.map(toPublicAccount);
  }

  async getAccount(organizationId: string, id: string) {
    const account = await this.findOwnedAccount(organizationId, id);
    return toPublicAccount(account);
  }

  async connectAccount(organizationId: string, dto: ConnectWhatsAppDto) {
    const existing = await this.prisma.whatsAppAccount.findUnique({
      where: {
        organizationId_phoneNumberId: {
          organizationId,
          phoneNumberId: dto.phoneNumberId,
        },
      },
    });

    if (existing) {
      throw new ConflictException(
        'This WhatsApp phone number is already connected to the organization',
      );
    }

    const account = await this.prisma.whatsAppAccount.create({
      data: {
        organizationId,
        phoneNumberId: dto.phoneNumberId,
        businessAccountId: dto.businessAccountId,
        accessToken: dto.accessToken,
        status: WhatsAppAccountStatus.CONNECTED,
        connectedAt: new Date(),
      },
    });

    return toPublicAccount(account);
  }

  async updateAccount(organizationId: string, id: string, dto: UpdateWhatsAppDto) {
    await this.findOwnedAccount(organizationId, id);

    const data: {
      accessToken?: string;
      status?: WhatsAppAccountStatus;
      connectedAt?: Date | null;
    } = {};

    if (dto.accessToken) {
      data.accessToken = dto.accessToken;
    }

    if (dto.status) {
      data.status = dto.status;
      if (dto.status === WhatsAppAccountStatus.CONNECTED) {
        data.connectedAt = new Date();
      }
      if (dto.status === WhatsAppAccountStatus.DISCONNECTED) {
        data.connectedAt = null;
      }
    }

    const account = await this.prisma.whatsAppAccount.update({
      where: { id },
      data,
    });

    return toPublicAccount(account);
  }

  async disconnectAccount(organizationId: string, id: string) {
    await this.findOwnedAccount(organizationId, id);

    const account = await this.prisma.whatsAppAccount.update({
      where: { id },
      data: {
        status: WhatsAppAccountStatus.DISCONNECTED,
        connectedAt: null,
      },
    });

    return toPublicAccount(account);
  }

  async removeAccount(organizationId: string, id: string) {
    await this.findOwnedAccount(organizationId, id);
    await this.prisma.whatsAppAccount.delete({ where: { id } });
    return { deleted: true };
  }

  private async findOwnedAccount(organizationId: string, id: string) {
    const account = await this.prisma.whatsAppAccount.findFirst({
      where: { id, organizationId },
    });

    if (!account) {
      throw new NotFoundException('WhatsApp account not found');
    }

    return account;
  }
}

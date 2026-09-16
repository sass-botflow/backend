import { Injectable, Logger } from '@nestjs/common';
import { MemberRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

export type ProvisionAuthUserInput = {
  authUserId: string;
  email: string;
  name: string;
};

export type ProvisionAuthUserResult = {
  botflowUserId: string;
  defaultOrganizationId: string;
  organizationName: string;
  organizationSlug: string;
  linkedExistingUser: boolean;
};

@Injectable()
export class WorkspaceProvisioningService {
  private readonly logger = new Logger(WorkspaceProvisioningService.name);

  constructor(private readonly prisma: PrismaService) {}

  async provisionForAuthUser(
    input: ProvisionAuthUserInput,
  ): Promise<ProvisionAuthUserResult> {
    const email = input.email.trim().toLowerCase();

    const existingAuthUser = await this.prisma.authUser.findUnique({
      where: { id: input.authUserId },
    });

    if (existingAuthUser?.botflowUserId && existingAuthUser.defaultOrganizationId) {
      const org = await this.prisma.organization.findUniqueOrThrow({
        where: { id: existingAuthUser.defaultOrganizationId },
      });
      return {
        botflowUserId: existingAuthUser.botflowUserId,
        defaultOrganizationId: existingAuthUser.defaultOrganizationId,
        organizationName: org.name,
        organizationSlug: org.slug,
        linkedExistingUser: false,
      };
    }

    const existingBotflowUser = await this.prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          include: { organization: true },
          take: 1,
        },
      },
    });

    if (existingBotflowUser) {
      const membership = existingBotflowUser.memberships[0];
      const defaultOrganizationId = membership?.organizationId;

      await this.prisma.authUser.update({
        where: { id: input.authUserId },
        data: {
          botflowUserId: existingBotflowUser.id,
          defaultOrganizationId,
        },
      });

      this.logger.log(
        `Linked Better Auth user ${input.authUserId} to existing BotFlow user ${existingBotflowUser.id}`,
      );

      return {
        botflowUserId: existingBotflowUser.id,
        defaultOrganizationId: defaultOrganizationId ?? '',
        organizationName: membership?.organization.name ?? `${input.name}'s Workspace`,
        organizationSlug: membership?.organization.slug ?? '',
        linkedExistingUser: true,
      };
    }

    const username = await this.uniqueUsernameFromEmail(email);
    const orgName = `${input.name.trim() || 'BotFlow User'}'s Workspace`;
    const slug = this.slugify(orgName);

    const botflowUser = await this.prisma.user.create({
      data: {
        username,
        email,
        name: input.name.trim() || 'BotFlow User',
        password: null,
        emailVerified: false,
        memberships: {
          create: {
            role: MemberRole.OWNER,
            organization: {
              create: {
                name: orgName,
                slug: `${slug}-${Date.now().toString(36)}`,
                subscription: { create: {} },
                branding: { create: {} },
              },
            },
          },
        },
      },
      include: {
        memberships: { include: { organization: true } },
      },
    });

    const org = botflowUser.memberships[0].organization;

    await this.prisma.authUser.update({
      where: { id: input.authUserId },
      data: {
        botflowUserId: botflowUser.id,
        defaultOrganizationId: org.id,
      },
    });

    this.logger.log(
      `Provisioned workspace ${org.id} for Better Auth user ${input.authUserId}`,
    );

    return {
      botflowUserId: botflowUser.id,
      defaultOrganizationId: org.id,
      organizationName: org.name,
      organizationSlug: org.slug,
      linkedExistingUser: false,
    };
  }

  async markBotflowEmailVerified(authUserId: string): Promise<void> {
    const authUser = await this.prisma.authUser.findUnique({
      where: { id: authUserId },
      select: { botflowUserId: true },
    });

    if (!authUser?.botflowUserId) return;

    await this.prisma.user.update({
      where: { id: authUser.botflowUserId },
      data: { emailVerified: true },
    });
  }

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private async uniqueUsernameFromEmail(email: string): Promise<string> {
    const base = email
      .split('@')[0]
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 24);

    const seed = base.length >= 3 ? base : 'user';
    let candidate = seed;
    let attempt = 0;

    while (attempt < 20) {
      const taken = await this.prisma.user.findUnique({ where: { username: candidate } });
      if (!taken) return candidate;
      candidate = `${seed}_${Date.now().toString(36).slice(-4)}${attempt}`.slice(0, 32);
      attempt += 1;
    }

    return `user_${Date.now().toString(36)}`;
  }
}

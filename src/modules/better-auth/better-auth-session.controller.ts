import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  AuthGuard,
  Session,
  UserSession,
} from '@thallesp/nestjs-better-auth';
import { PrismaService } from '../../common/prisma/prisma.service';

@ApiTags('Better Auth')
@ApiCookieAuth()
@Controller('api/better-auth')
@UseGuards(AuthGuard)
export class BetterAuthSessionController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('me')
  @ApiOperation({
    summary: 'Better Auth session with BotFlow workspace context',
    description:
      'Returns the Better Auth session plus linked BotFlow user and default workspace. Requires Better Auth session cookie. Mounted outside /api/auth/better to avoid Better Auth middleware capturing the route.',
  })
  async getSessionContext(@Session() session: UserSession) {
    const authUser = await this.prisma.authUser.findUnique({
      where: { id: session.user.id },
      select: {
        botflowUserId: true,
        defaultOrganizationId: true,
      },
    });

    const botflowUser = authUser?.botflowUserId
      ? await this.prisma.user.findUnique({
          where: { id: authUser.botflowUserId },
          select: {
            id: true,
            email: true,
            username: true,
            name: true,
            avatarUrl: true,
            emailVerified: true,
          },
        })
      : null;

    const organization = authUser?.defaultOrganizationId
      ? await this.prisma.organization.findUnique({
          where: { id: authUser.defaultOrganizationId },
          select: {
            id: true,
            name: true,
            slug: true,
            subscription: {
              select: {
                status: true,
                plan: true,
                currentPeriodEnd: true,
              },
            },
          },
        })
      : null;

    return {
      session,
      botflowUser,
      organization,
    };
  }
}

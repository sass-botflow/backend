import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { MemberRole, PlanTier, SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
import { StartTrialDto } from './dto/start-trial.dto';

const TRIAL_DAYS = 14;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();

    const existingEmail = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingEmail) {
      throw new ConflictException('Email already registered');
    }

    const username = await this.uniqueUsernameFromEmail(email);
    const slug = dto.organizationName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const password = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        username,
        email,
        name: dto.name,
        password,
        memberships: {
          create: {
            role: MemberRole.OWNER,
            organization: {
              create: {
                name: dto.organizationName,
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

    const org = user.memberships[0].organization;
    const token = this.signToken(user.id, user.email!, org.id, user.username);

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
      },
      organization: { id: org.id, name: org.name, slug: org.slug },
      token,
    };
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        memberships: { include: { organization: true }, take: 1 },
      },
    });

    if (!user?.password) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const membership = user.memberships[0];
    const token = this.signToken(
      user.id,
      user.email!,
      membership?.organizationId,
      user.username,
    );

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
      },
      organization: membership
        ? {
            id: membership.organization.id,
            name: membership.organization.name,
            slug: membership.organization.slug,
          }
        : null,
      token,
    };
  }

  async getProfile(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        avatarUrl: true,
        memberships: {
          include: {
            organization: {
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
            },
          },
        },
      },
    });
  }

  /** One-click 14-day trial — no email, instant dashboard access */
  async startTrial(dto?: StartTrialDto) {
    const suffix = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const username = `trial_${suffix}`.slice(0, 32);
    const displayName = dto?.name?.trim() || 'BotFlow User';
    const orgName = `${displayName}'s Workspace`;
    const slug = `trial-${suffix}`;
    const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);

    const user = await this.prisma.user.create({
      data: {
        username,
        email: null,
        name: displayName,
        password: null,
        memberships: {
          create: {
            role: MemberRole.OWNER,
            organization: {
              create: {
                name: orgName,
                slug,
                subscription: {
                  create: {
                    status: SubscriptionStatus.TRIALING,
                    plan: PlanTier.STARTER,
                    currentPeriodEnd: trialEndsAt,
                  },
                },
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

    const org = user.memberships[0].organization;
    const token = this.signToken(user.id, null, org.id, user.username);

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        name: user.name,
      },
      organization: { id: org.id, name: org.name, slug: org.slug },
      token,
      trial: {
        days: TRIAL_DAYS,
        endsAt: trialEndsAt.toISOString(),
        status: 'TRIALING' as const,
      },
      redirectTo: '/dashboard',
    };
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
      candidate = `${seed}_${Date.now().toString(36).slice(-4)}${attempt}`;
      candidate = candidate.slice(0, 32);
      attempt += 1;
    }

    return `user_${Date.now().toString(36)}`;
  }

  private signToken(
    sub: string,
    email: string | null,
    organizationId?: string,
    username?: string,
  ) {
    return this.jwt.sign({
      sub,
      email: email ?? undefined,
      username,
      organizationId,
    });
  }
}

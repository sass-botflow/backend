import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { MemberRole } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already registered');

    const slug = dto.organizationName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const password = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
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
    const token = this.signToken(user.id, user.email, org.id);

    return {
      user: { id: user.id, email: user.email, name: user.name },
      organization: { id: org.id, name: org.name, slug: org.slug },
      token,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
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
      user.email,
      membership?.organizationId,
    );

    return {
      user: { id: user.id, email: user.email, name: user.name },
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
        name: true,
        avatarUrl: true,
        memberships: {
          include: { organization: { select: { id: true, name: true, slug: true } } },
        },
      },
    });
  }

  private signToken(sub: string, email: string, organizationId?: string) {
    return this.jwt.sign({ sub, email, organizationId });
  }
}

import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule as BetterAuthNestModule } from '@thallesp/nestjs-better-auth';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { PrismaService } from '../../common/prisma/prisma.service';
import { createBetterAuth } from './better-auth.config';
import { BetterAuthSessionController } from './better-auth-session.controller';
import { BetterAuthSharedModule } from './better-auth-shared.module';
import { AuthEmailService } from './email.service';
import { WorkspaceProvisioningService } from './workspace-provisioning.service';

@Module({
  imports: [
    BetterAuthSharedModule,
    BetterAuthNestModule.forRootAsync({
      disableGlobalAuthGuard: true,
      isGlobal: true,
      imports: [ConfigModule, PrismaModule, BetterAuthSharedModule],
      inject: [
        ConfigService,
        PrismaService,
        AuthEmailService,
        WorkspaceProvisioningService,
      ],
      useFactory: (
        config: ConfigService,
        prisma: PrismaService,
        emailService: AuthEmailService,
        workspaceProvisioning: WorkspaceProvisioningService,
      ) => {
        const port = config.get<string>('PORT') ?? '8000';
        const baseUrl =
          config.get<string>('BETTER_AUTH_URL') ??
          config.get<string>('BACKEND_URL') ??
          `http://localhost:${port}`;

        const trustedOrigins = (config.get<string>('CORS_ORIGIN') ??
          'http://localhost:3000')
          .split(',')
          .map((origin) => origin.trim())
          .filter(Boolean);

        return {
          auth: createBetterAuth({
            prisma,
            emailService,
            workspaceProvisioning,
            secret: config.getOrThrow<string>('BETTER_AUTH_SECRET'),
            baseUrl,
            trustedOrigins,
          }),
        };
      },
    }),
  ],
  controllers: [BetterAuthSessionController],
})
export class BetterAuthModule {}

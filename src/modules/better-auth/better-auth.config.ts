import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { PrismaClient } from '@prisma/client';
import type { AuthEmailService } from './email.service';
import type { WorkspaceProvisioningService } from './workspace-provisioning.service';

export const BETTER_AUTH_BASE_PATH = '/api/auth/better';

export type BetterAuthFactoryDeps = {
  prisma: PrismaClient;
  emailService: AuthEmailService;
  workspaceProvisioning: WorkspaceProvisioningService;
  secret: string;
  baseUrl: string;
  trustedOrigins: string[];
};

export function createBetterAuth(deps: BetterAuthFactoryDeps) {
  const {
    prisma,
    emailService,
    workspaceProvisioning,
    secret,
    baseUrl,
    trustedOrigins,
  } = deps;

  return betterAuth({
    appName: 'BotFlow',
    basePath: BETTER_AUTH_BASE_PATH,
    secret,
    baseURL: baseUrl,
    trustedOrigins,
    database: prismaAdapter(prisma, {
      provider: 'postgresql',
    }),
    user: {
      modelName: 'authUser',
      additionalFields: {
        botflowUserId: {
          type: 'string',
          required: false,
          input: false,
        },
        defaultOrganizationId: {
          type: 'string',
          required: false,
          input: false,
        },
      },
    },
    session: {
      modelName: 'authSession',
    },
    account: {
      modelName: 'authAccount',
    },
    verification: {
      modelName: 'authVerification',
    },
    advanced: {
      database: {
        joins: true,
      },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      autoSignIn: false,
      sendResetPassword: async ({ user, url }) => {
        await emailService.sendPasswordResetEmail({
          to: user.email,
          name: user.name,
          url,
        });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendVerificationEmail: async ({ user, url }) => {
        await emailService.sendVerificationEmail({
          to: user.email,
          name: user.name,
          url,
        });
      },
      afterEmailVerification: async (user) => {
        await workspaceProvisioning.markBotflowEmailVerified(user.id);
      },
    },
    hooks: {},
  });
}

export type BetterAuthInstance = ReturnType<typeof createBetterAuth>;

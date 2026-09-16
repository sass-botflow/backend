import { Injectable, Logger } from '@nestjs/common';
import { AfterHook, AuthHookContext, Hook } from '@thallesp/nestjs-better-auth';
import { WorkspaceProvisioningService } from '../workspace-provisioning.service';

type SignUpResponse = {
  user?: {
    id: string;
    email: string;
    name: string;
    botflowUserId?: string | null;
  };
};

@Hook()
@Injectable()
export class BetterAuthSignUpHook {
  private readonly logger = new Logger(BetterAuthSignUpHook.name);

  constructor(
    private readonly workspaceProvisioning: WorkspaceProvisioningService,
  ) {}

  @AfterHook('/sign-up/email')
  async handleSignUp(ctx: AuthHookContext): Promise<void> {
    const returned = ctx.context.returned as SignUpResponse | Response | undefined;
    if (!returned || returned instanceof Response) return;

    const authUser = returned.user;
    if (!authUser?.id || !authUser.email) return;

    if (authUser.botflowUserId) return;

    try {
      await this.workspaceProvisioning.provisionForAuthUser({
        authUserId: authUser.id,
        email: authUser.email,
        name: authUser.name,
      });
    } catch (error) {
      this.logger.error(
        `Workspace provisioning failed for auth user ${authUser.id}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }
}

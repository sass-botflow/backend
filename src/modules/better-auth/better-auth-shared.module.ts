import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { AuthEmailService } from './email.service';
import { WorkspaceProvisioningService } from './workspace-provisioning.service';

@Module({
  imports: [ConfigModule, PrismaModule],
  providers: [AuthEmailService, WorkspaceProvisioningService],
  exports: [AuthEmailService, WorkspaceProvisioningService],
})
export class BetterAuthSharedModule {}

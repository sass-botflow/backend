import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './common/prisma/prisma.module';
import { RedisModule } from './common/redis/redis.module';
import { AuthModule } from './modules/auth/auth.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { InboxModule } from './modules/inbox/inbox.module';
import { BotsModule } from './modules/bots/bots.module';
import { CrmModule } from './modules/crm/crm.module';
import { AppointmentsModule } from './modules/appointments/appointments.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { KnowledgeModule } from './modules/knowledge/knowledge.module';
import { BillingModule } from './modules/billing/billing.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SettingsModule } from './modules/settings/settings.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { HealthModule } from './modules/health/health.module';
import { MetaModule } from './modules/meta/meta.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    RedisModule,
    HealthModule,
    AuthModule,
    OrganizationsModule,
    InboxModule,
    BotsModule,
    CrmModule,
    AppointmentsModule,
    AnalyticsModule,
    KnowledgeModule,
    BillingModule,
    NotificationsModule,
    SettingsModule,
    IntegrationsModule,
    MetaModule,
    WebhooksModule,
  ],
})
export class AppModule {}

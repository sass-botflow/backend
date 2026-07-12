import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InstagramChannelsController } from './instagram-channels.controller';
import { InstagramAuthController } from './instagram-auth.controller';
import { InstagramAuthService } from './instagram-auth.service';
import { InstagramAuthGuard, MetaConfigGuard } from './guards/instagram-auth.guard';
import { MetaGraphService } from './meta-graph.service';

@Module({
  imports: [AuthModule],
  controllers: [InstagramAuthController, InstagramChannelsController],
  providers: [
    InstagramAuthService,
    MetaGraphService,
    MetaConfigGuard,
    InstagramAuthGuard,
  ],
  exports: [InstagramAuthService, MetaGraphService],
})
export class InstagramModule {}

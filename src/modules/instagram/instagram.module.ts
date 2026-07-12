import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InstagramAuthController } from './instagram-auth.controller';
import { InstagramAuthService } from './instagram-auth.service';
import { InstagramAuthGuard, MetaConfigGuard } from './guards/instagram-auth.guard';
import { MetaGraphService } from './meta-graph.service';

@Module({
  imports: [AuthModule],
  controllers: [InstagramAuthController],
  providers: [
    InstagramAuthService,
    MetaGraphService,
    MetaConfigGuard,
    InstagramAuthGuard,
  ],
  exports: [InstagramAuthService, MetaGraphService],
})
export class InstagramModule {}

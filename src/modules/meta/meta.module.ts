import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MetaController } from './meta.controller';
import { MetaGraphApiService } from './meta-graph-api.service';
import { MetaService } from './meta.service';
import { MetaStateService } from './meta-state.service';

@Module({
  imports: [AuthModule],
  controllers: [MetaController],
  providers: [MetaService, MetaStateService, MetaGraphApiService],
  exports: [MetaService],
})
export class MetaModule {}

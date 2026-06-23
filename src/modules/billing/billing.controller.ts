import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PlanTier } from '@prisma/client';
import { BillingService } from './billing.service';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

@ApiTags('billing')
@Controller('api/billing')
@UseGuards(AuthGuard('jwt'))
@ApiBearerAuth()
export class BillingController {
  constructor(private readonly service: BillingService) {}

  @Get('subscription')
  subscription(@CurrentUser() user: JwtPayload) {
    return this.service.getSubscription(user.organizationId!);
  }

  @Get('plans')
  plans() {
    return this.service.getPlans();
  }

  @Post('checkout')
  checkout(
    @CurrentUser() user: JwtPayload,
    @Body() body: { plan: PlanTier; successUrl: string; cancelUrl: string },
  ) {
    return this.service.createCheckout(user.organizationId!, body);
  }
}

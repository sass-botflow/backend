import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PlanTier } from '@prisma/client';
import Stripe from 'stripe';
import { PrismaService } from '../../common/prisma/prisma.service';

const PLANS = [
  {
    tier: PlanTier.STARTER,
    name: 'Starter',
    price: 49,
    features: ['1 channel', '1 bot', '500 contacts', 'Basic analytics'],
    stripePriceEnv: 'STRIPE_PRICE_STARTER',
  },
  {
    tier: PlanTier.PROFESSIONAL,
    name: 'Professional',
    price: 149,
    features: ['All channels', 'Unlimited bots', 'CRM & pipelines', 'AI knowledge base'],
    stripePriceEnv: 'STRIPE_PRICE_PROFESSIONAL',
  },
  {
    tier: PlanTier.AGENCY,
    name: 'Agency',
    price: 399,
    features: ['Multi-client', 'White label', 'Team management', 'Priority support'],
    stripePriceEnv: 'STRIPE_PRICE_AGENCY',
  },
];

@Injectable()
export class BillingService {
  private stripe: Stripe | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const key = config.get<string>('STRIPE_SECRET_KEY');
    if (key) this.stripe = new Stripe(key);
  }

  getPlans() {
    return PLANS;
  }

  async getSubscription(organizationId: string) {
    return this.prisma.subscription.findUnique({
      where: { organizationId },
    });
  }

  async createCheckout(
    organizationId: string,
    data: { plan: PlanTier; successUrl: string; cancelUrl: string },
  ) {
    if (!this.stripe) throw new BadRequestException('Stripe not configured');

    const plan = PLANS.find((p) => p.tier === data.plan);
    const priceId = this.config.get<string>(plan!.stripePriceEnv);
    if (!priceId) throw new BadRequestException('Stripe price not configured');

    let subscription = await this.prisma.subscription.findUnique({
      where: { organizationId },
    });

    let customerId = subscription?.stripeCustomerId;
    if (!customerId) {
      const org = await this.prisma.organization.findUnique({ where: { id: organizationId } });
      const customer = await this.stripe.customers.create({ name: org!.name });
      customerId = customer.id;
      await this.prisma.subscription.update({
        where: { organizationId },
        data: { stripeCustomerId: customerId },
      });
    }

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: data.successUrl,
      cancel_url: data.cancelUrl,
      metadata: { organizationId, plan: data.plan },
    });

    return { url: session.url };
  }
}

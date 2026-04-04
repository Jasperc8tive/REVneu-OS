import { Injectable } from '@nestjs/common'
import { PrismaService } from '@revneu/database'

type Plan = {
  id: string
  name: string
  priceNgn: number
  priceUsd?: number
  maxUsers: number
  maxIntegrations: number
  maxAgents: number
  description: string
}

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  getPlans(): Plan[] {
    return [
      {
        id: 'starter',
        name: 'Starter',
        priceNgn: 49000,
        priceUsd: 30,
        maxUsers: 3,
        maxIntegrations: 2,
        maxAgents: 2,
        description: 'For early-stage teams validating growth loops.',
      },
      {
        id: 'growth',
        name: 'Growth',
        priceNgn: 150000,
        priceUsd: 95,
        maxUsers: 10,
        maxIntegrations: 6,
        maxAgents: 5,
        description: 'For scaling teams running cross-channel optimization.',
      },
      {
        id: 'scale',
        name: 'Scale',
        priceNgn: 450000,
        priceUsd: 280,
        maxUsers: 25,
        maxIntegrations: 999,
        maxAgents: 7,
        description: 'For mature organizations with advanced automation.',
      },
    ]
  }

  async getSubscription(organizationId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        subscriptionTier: true,
        subscriptionStatus: true,
        trialEndsAt: true,
      },
    })

    if (!organization) {
      return null
    }

    const tier = organization.subscriptionTier
    const planId = tier.toLowerCase()

    return {
      id: `sub_${organization.id}`,
      organizationId: organization.id,
      planId,
      planName: tier,
      status: organization.subscriptionStatus,
      currentPeriodStart: new Date().toISOString(),
      currentPeriodEnd: organization.trialEndsAt?.toISOString() ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      billedAt: null,
      nextBillingDate: organization.trialEndsAt?.toISOString() ?? null,
      amountPaid: 0,
      currency: 'NGN',
    }
  }

  async getInvoices(organizationId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, createdAt: true },
    })

    if (!organization) {
      return []
    }

    return [
      {
        id: `inv_${organization.id}_trial`,
        date: organization.createdAt.toISOString(),
        amount: 0,
        currency: 'NGN',
        status: 'TRIAL',
      },
    ]
  }
}

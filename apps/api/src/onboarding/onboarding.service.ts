import { BadRequestException, Injectable } from '@nestjs/common'
import { PrismaService } from '@revneu/database'

export type OnboardingStep =
  | 'org_profile'
  | 'invite_team'
  | 'connect_integrations'
  | 'run_agents'
  | 'review_recommendations'

type OnboardingProgress = {
  currentStep: OnboardingStep
  completedSteps: OnboardingStep[]
  progressPercent: number
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  'org_profile',
  'invite_team',
  'connect_integrations',
  'run_agents',
  'review_recommendations',
]

const ONBOARDING_AUDIT_ACTION = 'onboarding.progress'

function isOnboardingStep(value: unknown): value is OnboardingStep {
  return typeof value === 'string' && ONBOARDING_STEPS.includes(value as OnboardingStep)
}

function toProgress(payload: unknown): OnboardingProgress | null {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const obj = payload as {
    currentStep?: unknown
    completedSteps?: unknown
    progressPercent?: unknown
  }

  if (!isOnboardingStep(obj.currentStep)) {
    return null
  }

  if (!Array.isArray(obj.completedSteps) || !obj.completedSteps.every(isOnboardingStep)) {
    return null
  }

  if (typeof obj.progressPercent !== 'number') {
    return null
  }

  return {
    currentStep: obj.currentStep,
    completedSteps: obj.completedSteps,
    progressPercent: obj.progressPercent,
  }
}

@Injectable()
export class OnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  private getInitialProgress(): OnboardingProgress {
    return {
      currentStep: ONBOARDING_STEPS[0],
      completedSteps: [],
      progressPercent: 0,
    }
  }

  async getProgress(organizationId: string): Promise<OnboardingProgress> {
    const latest = await this.prisma.auditLog.findFirst({
      where: {
        organizationId,
        action: ONBOARDING_AUDIT_ACTION,
      },
      orderBy: { createdAt: 'desc' },
      select: { changes: true },
    })

    const parsed = toProgress(latest?.changes)
    if (parsed) {
      return parsed
    }

    return this.getInitialProgress()
  }

  async completeStep(organizationId: string, step: OnboardingStep): Promise<OnboardingProgress> {
    if (!ONBOARDING_STEPS.includes(step)) {
      throw new BadRequestException('Invalid onboarding step')
    }

    const current = await this.getProgress(organizationId)

    const completed = current.completedSteps.includes(step)
      ? current.completedSteps
      : [...current.completedSteps, step]

    const nextStep = ONBOARDING_STEPS.find((item) => !completed.includes(item))

    const updated: OnboardingProgress = {
      currentStep: nextStep ?? ONBOARDING_STEPS[ONBOARDING_STEPS.length - 1],
      completedSteps: completed,
      progressPercent: Math.round((completed.length / ONBOARDING_STEPS.length) * 100),
    }

    await this.prisma.auditLog.create({
      data: {
        organizationId,
        action: ONBOARDING_AUDIT_ACTION,
        resourceType: 'onboarding',
        resourceId: organizationId,
        changes: updated,
      },
    })

    return updated
  }
}

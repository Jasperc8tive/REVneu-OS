import { BadRequestException, Injectable } from '@nestjs/common'

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

@Injectable()
export class OnboardingService {
  private readonly progressByOrg = new Map<string, OnboardingProgress>()

  getProgress(organizationId: string): OnboardingProgress {
    const existing = this.progressByOrg.get(organizationId)
    if (existing) {
      return existing
    }

    const initial = {
      currentStep: ONBOARDING_STEPS[0],
      completedSteps: [],
      progressPercent: 0,
    }
    this.progressByOrg.set(organizationId, initial)
    return initial
  }

  completeStep(organizationId: string, step: OnboardingStep): OnboardingProgress {
    if (!ONBOARDING_STEPS.includes(step)) {
      throw new BadRequestException('Invalid onboarding step')
    }

    const current = this.getProgress(organizationId)

    const completed = current.completedSteps.includes(step)
      ? current.completedSteps
      : [...current.completedSteps, step]

    const nextStep = ONBOARDING_STEPS.find((item) => !completed.includes(item))

    const updated: OnboardingProgress = {
      currentStep: nextStep ?? ONBOARDING_STEPS[ONBOARDING_STEPS.length - 1],
      completedSteps: completed,
      progressPercent: Math.round((completed.length / ONBOARDING_STEPS.length) * 100),
    }

    this.progressByOrg.set(organizationId, updated)
    return updated
  }
}

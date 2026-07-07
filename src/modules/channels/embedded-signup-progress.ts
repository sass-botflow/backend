import { BadRequestException } from '@nestjs/common';
import {
  EmbeddedSignupProgressStep,
  EmbeddedSignupStep,
  EmbeddedSignupStepStatus,
} from './channels.constants';

export class EmbeddedSignupProgressTracker {
  private readonly steps: EmbeddedSignupProgressStep[] = [];

  complete(step: EmbeddedSignupStep, message?: string): void {
    this.steps.push({ step, status: 'completed', message });
  }

  skip(step: EmbeddedSignupStep, message?: string): void {
    this.steps.push({ step, status: 'skipped', message });
  }

  fail(step: EmbeddedSignupStep, message: string): never {
    this.steps.push({ step, status: 'failed', message });
    throw new BadRequestException({
      message,
      step,
      steps: this.steps,
    });
  }

  snapshot(): EmbeddedSignupProgressStep[] {
    return [...this.steps];
  }
}

export function isEmbeddedSignupProgressResponse(
  value: unknown,
): value is { step: EmbeddedSignupStep; steps: EmbeddedSignupProgressStep[] } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'step' in value &&
    'steps' in value
  );
}

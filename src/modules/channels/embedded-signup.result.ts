import {
  EmbeddedSignupProgressStep,
  EmbeddedSignupScenario,
} from './channels.constants';

export interface EmbeddedSignupNeedsWabaResult {
  status: 'needs_waba';
  action: 'CREATE_WABA';
  message: string;
  steps: EmbeddedSignupProgressStep[];
}

export interface EmbeddedSignupNeedsPhoneResult {
  status: 'needs_phone';
  action: 'ADD_PHONE_NUMBER';
  message: string;
  wabaId: string;
  businessId?: string;
  businessName?: string;
  steps: EmbeddedSignupProgressStep[];
}

export interface WhatsAppConnectedResult {
  connected: true;
  status: 'connected';
  channelId: string;
  workspaceId: string;
  phoneNumberId: string;
  wabaId: string;
  businessId: string;
  displayPhoneNumber: string;
  steps: EmbeddedSignupProgressStep[];
  scenario: EmbeddedSignupScenario;
}

export type EmbeddedSignupCompleteResult =
  | WhatsAppConnectedResult
  | EmbeddedSignupNeedsWabaResult
  | EmbeddedSignupNeedsPhoneResult;

export function isEmbeddedSignupActionResponse(
  value: unknown,
): value is EmbeddedSignupNeedsWabaResult | EmbeddedSignupNeedsPhoneResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'action' in value &&
    'status' in value
  );
}

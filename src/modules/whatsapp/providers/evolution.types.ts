export interface EvolutionCreateInstanceResult {
  instanceName: string;
  mocked: boolean;
}

export interface EvolutionConnectResult {
  base64: string;
  mocked: boolean;
}

export type EvolutionInstanceState = 'open' | 'connecting' | 'close' | string;

export interface EvolutionConnectionStateResult {
  state: EvolutionInstanceState;
  phoneNumber: string | null;
  profileName: string | null;
}

export interface EvolutionProviderConfig {
  baseUrl: string;
  apiKey: string;
}

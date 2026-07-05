export interface EvolutionCreateInstanceResult {
  instanceName: string;
  mocked: boolean;
}

export interface EvolutionConnectResult {
  base64: string;
  mocked: boolean;
}

export interface EvolutionProviderConfig {
  baseUrl: string;
  apiKey: string;
}

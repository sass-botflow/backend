export type EvolutionErrorCode =
  | 'EVOLUTION_UNAVAILABLE'
  | 'QR_EXPIRED'
  | 'SESSION_DELETED'
  | 'CONNECTION_LOST'
  | 'INSTANCE_NOT_FOUND'
  | 'EVOLUTION_REQUEST_FAILED';

export class EvolutionApiException extends Error {
  constructor(
    readonly code: EvolutionErrorCode,
    message: string,
    readonly statusCode = 502,
    readonly evolutionResponse?: unknown,
  ) {
    super(message);
    this.name = 'EvolutionApiException';
  }
}

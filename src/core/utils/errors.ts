export class SpecError extends Error {
  readonly code: string;
  readonly details: Record<string, unknown> | undefined;

  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

export function specError(code: string, message: string, details?: Record<string, unknown>): SpecError {
  return new SpecError(code, message, details);
}


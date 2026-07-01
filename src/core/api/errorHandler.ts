export type AppErrorType =
  | 'VALIDATION'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'NETWORK'
  | 'TIMEOUT'
  | 'SERVER'
  | 'UNKNOWN';

export type AppError = {
  type: AppErrorType;
  message: string;
  statusCode?: number;
  code?: string;
  details?: unknown;
  requestId?: string;
  retryAfterSeconds?: number;
  retryable?: boolean;
  serverTime?: string;
};

export class ApiRequestError extends Error implements AppError {
  readonly type: AppErrorType;
  readonly statusCode?: number;
  readonly code?: string;
  readonly details?: unknown;
  readonly requestId?: string;
  readonly retryAfterSeconds?: number;
  readonly retryable?: boolean;
  readonly serverTime?: string;

  constructor(error: AppError) {
    super(error.message);
    this.name = 'ApiRequestError';
    this.type = error.type;
    this.statusCode = error.statusCode;
    this.code = error.code;
    this.details = error.details;
    this.requestId = error.requestId;
    this.retryAfterSeconds = error.retryAfterSeconds;
    this.retryable = error.retryable;
    this.serverTime = error.serverTime;
  }
}

export function normalizeApiError(error: unknown): AppError {
  if (isTimeoutError(error)) {
    return {
      type: 'TIMEOUT',
      message: 'La solicitud tardó demasiado. Intenta de nuevo.',
      retryable: true,
    };
  }

  if (error instanceof ApiRequestError) {
    return error;
  }

  if (error instanceof Response) {
    return normalizeResponseError(error);
  }

  if (error instanceof TypeError) {
    return {
      type: 'NETWORK',
      message: 'No se pudo conectar con el servidor.',
    };
  }

  return {
    type: 'UNKNOWN',
    message: 'Ocurrio un error inesperado.',
  };
}

function isTimeoutError(error: unknown): boolean {
  if (!error) return false;

  if (error instanceof Error) {
    const name = String(error.name || '').toLowerCase();
    const message = String(error.message || '').toLowerCase();
    return (
      name.includes('timeout') ||
      (name === 'aborterror' && message.includes('timeout')) ||
      message.includes('request timeout') ||
      message.includes('timed out') ||
      message.includes('timeout')
    );
  }

  if (typeof error === 'object' && error !== null) {
    const candidate = error as { message?: unknown; name?: unknown };
    const message = String(candidate.message ?? '').toLowerCase();
    const name = String(candidate.name ?? '').toLowerCase();
    return (
      name.includes('timeout') ||
      message.includes('request timeout') ||
      message.includes('timed out') ||
      message.includes('timeout')
    );
  }

  return false;
}

export function normalizeResponseError(
  response: Response,
  payload?: unknown,
): AppError {
  const body = isErrorPayload(payload) ? payload : undefined;
  const backendMessage =
    body?.message ??
    (typeof payload === 'string' && payload.trim() ? payload : undefined);
  const shared = {
    statusCode: response.status,
    code: body?.code,
    details: payload,
    requestId:
      getStringValue(body?.requestId) ??
      getStringValue((body as any)?.error?.requestId) ??
      response.headers.get('x-request-id') ??
      undefined,
    retryAfterSeconds: getRetryAfterSeconds(response, body),
    retryable: getBooleanValue(body?.retryable),
    serverTime:
      getStringValue((body as any)?.meta?.serverTime) ??
      response.headers.get('date') ??
      undefined,
  };

  if (response.status === 400 || response.status === 422) {
    return {
      type: 'VALIDATION',
      message: backendMessage || 'Revisa los datos ingresados e intenta nuevamente.',
      ...shared,
    };
  }

  if (response.status === 401) {
    return {
      type: 'UNAUTHORIZED',
      message: backendMessage || 'Tu sesion expiro. Inicia sesion nuevamente.',
      ...shared,
    };
  }

  if (response.status === 403) {
    return {
      type: 'FORBIDDEN',
      message: backendMessage || 'No tienes permisos para realizar esta accion.',
      ...shared,
    };
  }

  if (response.status === 404) {
    return {
      type: 'NOT_FOUND',
      message: backendMessage || 'No se encontró el recurso solicitado.',
      ...shared,
    };
  }

  if (response.status === 409) {
    return {
      type: 'CONFLICT',
      message: backendMessage || 'La operación entró en conflicto con el estado actual.',
      ...shared,
    };
  }

  if (response.status === 429) {
    return {
      type: 'RATE_LIMITED',
      message: backendMessage || 'Se alcanzó el límite de peticiones.',
      ...shared,
      retryable: true,
    };
  }

  if (response.status >= 500) {
    return {
      type: 'SERVER',
      message: backendMessage || 'Ocurrio un error en el servidor.',
      ...shared,
    };
  }

  return {
    type: 'UNKNOWN',
    message: backendMessage || 'Ocurrio un error inesperado.',
    ...shared,
  };
}

function getBooleanValue(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function getStringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function isErrorPayload(
  payload: unknown,
): payload is { message?: string; code?: string } & Record<string, unknown> {
  return typeof payload === 'object' && payload !== null;
}

function getRetryAfterSeconds(
  response: Response,
  payload?: Record<string, unknown>,
): number | undefined {
  const bodyValue = Number(payload?.retryAfterSeconds);
  if (Number.isFinite(bodyValue) && bodyValue > 0) return bodyValue;

  const headerValue = Number(response.headers.get('Retry-After'));
  if (Number.isFinite(headerValue) && headerValue > 0) return headerValue;

  return undefined;
}

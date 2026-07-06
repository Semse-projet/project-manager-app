export class SemseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** 401 — token inválido, revocado o expirado. */
export class SemseAuthError extends SemseError {}

/** 403 — el token no tiene los scopes requeridos. */
export class SemseScopeError extends SemseError {
  constructor(message: string, public readonly missing: string[] = []) {
    super(message);
  }
}

/** 503 — kill switch de satélites apagado en SEMSE (SAT-000). */
export class SemseDisabledError extends SemseError {}

/** Fallo de red, timeout o respuesta no-JSON. */
export class SemseNetworkError extends SemseError {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
  }
}

/** Cualquier otro status HTTP de error. */
export class SemseApiError extends SemseError {
  constructor(message: string, public readonly status: number, public readonly body?: unknown) {
    super(message);
  }
}

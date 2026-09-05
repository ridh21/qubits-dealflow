export type DomainErrorCode =
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "NOT_EDITABLE"
  | "INSUFFICIENT_STOCK"
  | "CONFIGURATION"
  | "VALIDATION";

export class DomainError extends Error {
  constructor(
    readonly code: DomainErrorCode,
    message: string,
    readonly meta?: Record<string, unknown>,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class Forbidden extends DomainError {
  constructor(message = "You do not have access to this action.", meta?: Record<string, unknown>) {
    super("FORBIDDEN", message, meta);
  }
}
export class NotFound extends DomainError {
  constructor(message = "Not found.", meta?: Record<string, unknown>) {
    super("NOT_FOUND", message, meta);
  }
}
export class Conflict extends DomainError {
  constructor(message = "This record changed since you loaded it.", meta?: Record<string, unknown>) {
    super("CONFLICT", message, meta);
  }
}
export class NotEditable extends DomainError {
  constructor(message = "This record can no longer be edited.", meta?: Record<string, unknown>) {
    super("NOT_EDITABLE", message, meta);
  }
}
export class InsufficientStock extends DomainError {
  constructor(message = "Not enough stock available.", meta?: Record<string, unknown>) {
    super("INSUFFICIENT_STOCK", message, meta);
  }
}
export class ConfigurationError extends DomainError {
  constructor(message = "Required configuration is missing.", meta?: Record<string, unknown>) {
    super("CONFIGURATION", message, meta);
  }
}
export class ValidationError extends DomainError {
  constructor(message = "Some fields need attention.", meta?: Record<string, unknown>) {
    super("VALIDATION", message, meta);
  }
}

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; meta?: Record<string, unknown> } };

export function toActionError(e: unknown): ActionResult<never> {
  if (e instanceof DomainError) {
    return { ok: false, error: { code: e.code, message: e.message, meta: e.meta } };
  }
  console.error("[action] unexpected error", e);
  return {
    ok: false,
    error: { code: "UNEXPECTED", message: "Something went wrong. Please try again." },
  };
}

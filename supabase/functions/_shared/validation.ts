import { AppError } from "./errors.ts";

/**
 * Email validation regex
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Password validation requirements
 */
interface PasswordRequirements {
  minLength?: number;
  requireUppercase?: boolean;
  requireLowercase?: boolean;
  requireNumbers?: boolean;
  requireSpecialChars?: boolean;
}

/**
 * Validate email format
 */
export function validateEmail(email: string): void {
  if (!email || !EMAIL_REGEX.test(email)) {
    throw new AppError("Invalid email format", 400, "VALIDATION_ERROR", {
      field: "email",
      rule: "valid_email_format",
    });
  }
}

/**
 * Validate password strength
 */
export function validatePassword(
  password: string,
  requirements: PasswordRequirements = {
    minLength: 8,
    requireUppercase: true,
    requireLowercase: true,
    requireNumbers: true,
  }
): void {
  if (!password) {
    throw new AppError("Password is required", 400, "VALIDATION_ERROR", {
      field: "password",
    });
  }

  if (requirements.minLength && password.length < requirements.minLength) {
    throw new AppError(
      `Password must be at least ${requirements.minLength} characters`,
      400,
      "VALIDATION_ERROR",
      { field: "password", rule: "min_length", minLength: requirements.minLength }
    );
  }

  if (requirements.requireUppercase && !/[A-Z]/.test(password)) {
    throw new AppError(
      "Password must contain at least one uppercase letter",
      400,
      "VALIDATION_ERROR",
      { field: "password", rule: "require_uppercase" }
    );
  }

  if (requirements.requireLowercase && !/[a-z]/.test(password)) {
    throw new AppError(
      "Password must contain at least one lowercase letter",
      400,
      "VALIDATION_ERROR",
      { field: "password", rule: "require_lowercase" }
    );
  }

  if (requirements.requireNumbers && !/[0-9]/.test(password)) {
    throw new AppError(
      "Password must contain at least one number",
      400,
      "VALIDATION_ERROR",
      { field: "password", rule: "require_numbers" }
    );
  }

  if (
    requirements.requireSpecialChars &&
    !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
  ) {
    throw new AppError(
      "Password must contain at least one special character",
      400,
      "VALIDATION_ERROR",
      { field: "password", rule: "require_special_chars" }
    );
  }
}

/**
 * Validate UUID format
 */
export function validateUUID(value: string, fieldName: string = "id"): void {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(value)) {
    throw new AppError(`Invalid ${fieldName} format`, 400, "VALIDATION_ERROR", {
      field: fieldName,
      rule: "valid_uuid",
    });
  }
}

/**
 * Validate integer value
 */
export function validateInteger(
  value: any,
  fieldName: string,
  options?: { min?: number; max?: number }
): number {
  const parsed = Number.parseInt(String(value), 10);

  if (Number.isNaN(parsed)) {
    throw new AppError(
      `${fieldName} must be an integer`,
      400,
      "VALIDATION_ERROR",
      { field: fieldName, type: "integer" }
    );
  }

  if (options?.min !== undefined && parsed < options.min) {
    throw new AppError(
      `${fieldName} must be at least ${options.min}`,
      400,
      "VALIDATION_ERROR",
      { field: fieldName, min: options.min }
    );
  }

  if (options?.max !== undefined && parsed > options.max) {
    throw new AppError(
      `${fieldName} must be at most ${options.max}`,
      400,
      "VALIDATION_ERROR",
      { field: fieldName, max: options.max }
    );
  }

  return parsed;
}

/**
 * Validate string length
 */
export function validateStringLength(
  value: string,
  fieldName: string,
  minLength?: number,
  maxLength?: number
): void {
  if (!value || typeof value !== "string") {
    throw new AppError(`${fieldName} must be a string`, 400, "VALIDATION_ERROR", {
      field: fieldName,
      type: "string",
    });
  }

  if (minLength && value.trim().length < minLength) {
    throw new AppError(
      `${fieldName} must be at least ${minLength} characters`,
      400,
      "VALIDATION_ERROR",
      { field: fieldName, minLength }
    );
  }

  if (maxLength && value.length > maxLength) {
    throw new AppError(
      `${fieldName} must be at most ${maxLength} characters`,
      400,
      "VALIDATION_ERROR",
      { field: fieldName, maxLength }
    );
  }
}

/**
 * Validate enum value
 */
export function validateEnum(
  value: string,
  fieldName: string,
  allowedValues: string[]
): void {
  if (!allowedValues.includes(value)) {
    throw new AppError(
      `${fieldName} must be one of: ${allowedValues.join(", ")}`,
      400,
      "VALIDATION_ERROR",
      { field: fieldName, allowedValues, receivedValue: value }
    );
  }
}

/**
 * Validate request body has required fields
 */
export function validateRequestBody(
  body: any,
  requiredFields: string[]
): Record<string, any> {
  if (!body || typeof body !== "object") {
    throw new AppError("Request body is required", 400, "VALIDATION_ERROR");
  }

  const missing = requiredFields.filter(
    (field) => !(field in body) || body[field] === null || body[field] === undefined
  );

  if (missing.length > 0) {
    throw new AppError(
      `Missing required fields: ${missing.join(", ")}`,
      400,
      "VALIDATION_ERROR",
      { missing }
    );
  }

  return body;
}

/**
 * Sanitize string input (basic XSS prevention)
 */
export function sanitizeString(value: string): string {
  if (!value) return "";
  return String(value)
    .trim()
    .replace(/[<>]/g, "")
    .substring(0, 10000); // Limit to 10k chars
}

/**
 * Validate and parse JSON field
 */
export function validateJsonField(
  value: any,
  fieldName: string
): Record<string, any> {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch (error) {
      throw new AppError(
        `${fieldName} must be valid JSON`,
        400,
        "VALIDATION_ERROR",
        { field: fieldName, parseError: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  if (typeof value === "object" && value !== null) {
    return value;
  }

  throw new AppError(
    `${fieldName} must be an object or JSON string`,
    400,
    "VALIDATION_ERROR",
    { field: fieldName }
  );
}

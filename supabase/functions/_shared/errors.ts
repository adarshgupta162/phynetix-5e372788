/**
 * Standard error response structure for all edge functions
 */
export interface ErrorResponse {
  error: string;
  code?: string;
  details?: Record<string, any>;
  status: number;
}

/**
 * Custom error class for application errors
 */
export class AppError extends Error {
  constructor(
    public message: string,
    public status: number = 400,
    public code: string = "APP_ERROR",
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = "AppError";
  }
}

/**
 * Format error response with consistent structure
 */
export function formatErrorResponse(error: any): ErrorResponse {
  let message = "Unknown error";
  let status = 500;
  let code = "INTERNAL_ERROR";
  let details: Record<string, any> | undefined;

  if (error instanceof AppError) {
    message = error.message;
    status = error.status;
    code = error.code;
    details = error.details;
  } else if (error instanceof Error) {
    message = error.message;
    // Map common error messages to appropriate status codes
    if (message.includes("Unauthorized")) {
      status = 401;
      code = "UNAUTHORIZED";
    } else if (message.includes("not found")) {
      status = 404;
      code = "NOT_FOUND";
    } else if (message.includes("required")) {
      status = 400;
      code = "VALIDATION_ERROR";
    }
  } else if (typeof error === "string") {
    message = error;
  }

  return { error: message, status, code, details };
}

/**
 * Log error with context
 */
export function logError(context: string, error: any): void {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  
  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      context,
      message: errorMessage,
      stack,
    })
  );
}

/**
 * Validate required fields in request body
 */
export function validateRequired(
  body: Record<string, any>,
  requiredFields: string[]
): void {
  const missing = requiredFields.filter(
    (field) => !body[field] || String(body[field]).trim() === ""
  );

  if (missing.length > 0) {
    throw new AppError(
      `Missing required fields: ${missing.join(", ")}`,
      400,
      "VALIDATION_ERROR",
      { missing }
    );
  }
}

/**
 * Validate field type
 */
export function validateType(
  value: any,
  fieldName: string,
  expectedType: string
): void {
  if (typeof value !== expectedType) {
    throw new AppError(
      `Field '${fieldName}' must be of type ${expectedType}`,
      400,
      "VALIDATION_ERROR",
      { field: fieldName, expectedType, receivedType: typeof value }
    );
  }
}

/**
 * Handle database errors and convert to AppError
 */
export function handleDbError(
  error: any,
  context: string
): never {
  const message = error?.message || "Database operation failed";
  const code = error?.code || "DB_ERROR";
  const details = {
    dbCode: error?.code,
    dbMessage: error?.message,
    context,
  };

  logError(context, error);
  throw new AppError(message, 500, code, details);
}

/**
 * Safe JSON parse with error handling
 */
export function safeJsonParse(
  jsonString: string,
  fieldName: string = "body"
): Record<string, any> {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    throw new AppError(
      `Invalid JSON in ${fieldName}`,
      400,
      "PARSE_ERROR",
      { parseError: error instanceof Error ? error.message : String(error) }
    );
  }
}

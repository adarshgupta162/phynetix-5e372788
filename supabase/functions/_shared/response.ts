/**
 * Standard response headers for all edge functions
 */
export const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

/**
 * Create a success response
 */
export function successResponse<T>(
  data: T,
  status: number = 200
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: CORS_HEADERS,
  });
}

/**
 * Create an error response
 */
export function errorResponse(
  message: string,
  status: number = 400,
  code: string = "ERROR"
): Response {
  return new Response(
    JSON.stringify({
      error: message,
      code,
    }),
    {
      status,
      headers: CORS_HEADERS,
    }
  );
}

/**
 * Create a 401 Unauthorized response
 */
export function unauthorizedResponse(
  message: string = "Unauthorized"
): Response {
  return errorResponse(message, 401, "UNAUTHORIZED");
}

/**
 * Create a 403 Forbidden response
 */
export function forbiddenResponse(
  message: string = "Forbidden"
): Response {
  return errorResponse(message, 403, "FORBIDDEN");
}

/**
 * Create a 404 Not Found response
 */
export function notFoundResponse(
  message: string = "Not found"
): Response {
  return errorResponse(message, 404, "NOT_FOUND");
}

/**
 * Create a 500 Server Error response
 */
export function serverErrorResponse(
  message: string = "Internal server error"
): Response {
  return errorResponse(message, 500, "INTERNAL_ERROR");
}

/**
 * Handle CORS preflight requests
 */
export function handleCorsPreFlight(): Response {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    },
  });
}

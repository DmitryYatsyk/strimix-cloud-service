export const ERRORS = {
  AUTH: {
    AUTHENTICATION_ERROR: {
      status: 401,
      code: 'AUTHENTICATION_ERROR',
      message: 'Authentication error',
    },
  },
  OTHER: {
    INTERNAL_SERVER_ERROR: {
      status: 500,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Internal server error',
    },
    REQUEST_VALIDATION_ERROR: {
      status: 400,
      code: 'REQUEST_VALIDATION_ERROR',
      message: 'Request validation error',
    },
  },
}

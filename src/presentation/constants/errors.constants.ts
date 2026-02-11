export const ERRORS = {
  PROJECT: {
    NOT_FOUND: {
      status: 404,
      code: 'PROJECT_NOT_FOUND',
      message: 'Project not found',
    },
  },
  RESOURCE_GROUP: {
    NOT_FOUND: {
      status: 404,
      code: 'RESOURCE_GROUP_NOT_FOUND',
      message: 'Resource group not found',
    },
  },
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

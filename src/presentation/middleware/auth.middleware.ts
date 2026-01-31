import { Request, Response, NextFunction } from 'express'
import { HttpException } from '@presentation/exceptions/http.exception.js'
import { ERRORS } from '@presentation/constants/errors.constants.js'

function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Validate Authorization header against configured APP_AUTHORIZATION_CODES.
  // Throws standardized HttpException on missing or invalid code to be handled by global error handler.
  const authorizationCode = req.header('Authorization')
  if (!authorizationCode) {
    throw new HttpException(ERRORS.AUTH.AUTHENTICATION_ERROR)
  }

  const authCodes = JSON.parse(process.env.APP_AUTHORIZATION_CODES as string)
  const isValidCode = authCodes.some((el: { appName: string; authCode: string }) => {
    return el.authCode === authorizationCode
  })

  if (!isValidCode) {
    throw new HttpException(ERRORS.AUTH.AUTHENTICATION_ERROR)
  }

  return next()
}

export { authMiddleware }

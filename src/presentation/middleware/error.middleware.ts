import { Request, Response, NextFunction } from 'express'
import { HttpException } from '@presentation/exceptions/http.exception.js'
import { ERRORS } from '@presentation/constants/errors.constants.js'

const errorMiddleware = (
  error: HttpException,
  req: Request,
  res: Response,
  next: NextFunction,
): any => {
  // Check if response has already been sent
  if (res.headersSent) {
    return next(error)
  }

  const status = error.status || ERRORS.OTHER.INTERNAL_SERVER_ERROR.status
  const code = error.code || ERRORS.OTHER.INTERNAL_SERVER_ERROR.code
  const message = error.message || ERRORS.OTHER.INTERNAL_SERVER_ERROR.message
  const details = error.details || null

  return res.status(status).send({ error: { status, code, message, details } })
}

export { errorMiddleware }

import { ERRORS } from '@presentation/constants/errors.constants.js'
import { HttpException } from '@presentation/exceptions/http.exception.js'
import { NextFunction } from 'express'

const returnErrorResponse = (error: unknown, next: NextFunction) => {
  console.log('returnErrorResponse error:', error)

  // Check if the error is an instance of HttpException
  if (error instanceof HttpException) {
    return next(error)
  }
  return next(new HttpException(ERRORS.OTHER.INTERNAL_SERVER_ERROR))
}

export { returnErrorResponse }

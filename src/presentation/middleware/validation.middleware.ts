import { Request, Response, NextFunction, RequestHandler } from 'express'
import { returnErrorResponse } from '@presentation/utils/return-error-response.js'

const validationMiddleware = (validationFunction: any): RequestHandler => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const validatedRequest = validationFunction(req)
      req = validatedRequest
      return next()
    } catch (e: any) {
      return returnErrorResponse(e, next)
    }
  }
}

export { validationMiddleware }

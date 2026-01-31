import { Request, Response, NextFunction } from 'express'
import { returnErrorResponse } from '@presentation/utils/return-error-response'
import { getAvailableResourceGroups } from '@application/use-cases/resource-group/get-available-resource-groups'

export class ResourceGroupController {
  public static getAvailableResourceGroups = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const result = await getAvailableResourceGroups()
      res.status(200).json(result)
      return
    } catch (e: any) {
      returnErrorResponse(e, next)
    }
  }
}

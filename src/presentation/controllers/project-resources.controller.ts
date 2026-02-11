import { Request, Response, NextFunction } from 'express'
import { returnErrorResponse } from '@presentation/utils/return-error-response'
import { deployProjectResources } from '@application/use-cases/project-resources/deploy-project-resources'

export class ProjectResourcesController {
  public static deployProjectResources = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const projectId = Number(req.params.projectId)
      const resourceGroupId = req.body.resource_group_id
      const result = await deployProjectResources(projectId, resourceGroupId)
      res.status(200).json(result)
      return
    } catch (e: any) {
      returnErrorResponse(e, next)
    }
  }
}

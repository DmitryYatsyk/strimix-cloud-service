import { Router } from 'express'
import { IRouter } from '@presentation/interfaces/router.interface.js'
import { ProjectResourcesController } from '@presentation/controllers/project-resources.controller.js'
import { authMiddleware } from '@presentation/middleware/auth.middleware.js'
import { validationMiddleware } from '@presentation/middleware/validation.middleware.js'
import { deployProjectResourcesApiValidation } from '@presentation/api-validation/project-resources/project-resources.api.validation'

class ProjectResourcesRouter implements IRouter {
  public path: string = '/project-resources'
  public router = Router()

  constructor() {
    this.initialiseRoutes()
  }

  private initialiseRoutes(): void {
    this.router.post(
      `${this.path}/:projectId/deploy`,
      authMiddleware,
      validationMiddleware(deployProjectResourcesApiValidation),
      ProjectResourcesController.deployProjectResources,
    )
  }
}

export { ProjectResourcesRouter }

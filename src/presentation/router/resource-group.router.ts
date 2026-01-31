import { Router } from 'express'
import { IRouter } from '@presentation/interfaces/router.interface.js'
import { ResourceGroupController } from '@presentation/controllers/resource-group.controller.js'
import { authMiddleware } from '@presentation/middleware/auth.middleware.js'

class ResourceGroupRouter implements IRouter {
  public path: string = '/resource-groups'
  public router = Router()

  constructor() {
    this.initialiseRoutes()
  }

  private initialiseRoutes(): void {
    this.router.get(
      `${this.path}/get-available`,
      authMiddleware,
      ResourceGroupController.getAvailableResourceGroups,
    )
  }
}

export { ResourceGroupRouter }

import 'dotenv/config'
import { validateEnv } from '@presentation/utils/validate-env.util.js'
import { App } from '@/app.js'
import { ProjectResourcesRouter } from '@presentation/router/project-resources.router'
import { ResourceGroupRouter } from '@presentation/router/resource-group.router'

validateEnv()

// Data service application - final test
const app = new App(
  [new ProjectResourcesRouter(), new ResourceGroupRouter()],
  Number(process.env.PORT || 8080),
)

app.listen()

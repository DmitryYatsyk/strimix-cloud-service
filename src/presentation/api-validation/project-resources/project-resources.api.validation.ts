import { Request } from 'express'
import { deployProjectResourcesSchema } from '@presentation/api-schemas/project-resources/index.js'
import { validateReqBodySchema } from '@presentation/utils/validate-req-body-schema.util'

const deployProjectResourcesApiValidation = (req: Request): Request => {
  console.log(req.params)
  validateReqBodySchema(deployProjectResourcesSchema, req.params)
  return req
}

export { deployProjectResourcesApiValidation }

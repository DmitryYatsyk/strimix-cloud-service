import { Request } from 'express'
import {
  deployProjectResourceBodySchema,
  deployProjectResourceQuerySchema,
} from '@presentation/api-schemas/project-resources/index.js'
import { validateReqBodySchema } from '@presentation/utils/validate-req-body-schema.util'

const deployProjectResourcesApiValidation = (req: Request): Request => {
  validateReqBodySchema(deployProjectResourceQuerySchema, req.params)
  validateReqBodySchema(deployProjectResourceBodySchema, req.body)
  return req
}

export { deployProjectResourcesApiValidation }

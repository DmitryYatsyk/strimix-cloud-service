import { z } from 'zod'
import {
  objectIdStringSchema,
  requiredField,
} from '@presentation/utils/validate-req-body-schema.util'

const deployProjectResourceQuerySchema = z.object({
  projectId: z.coerce.number().int().positive(),
})

const deployProjectResourceBodySchema = z.object({
  resource_group_id: requiredField(
    'resource_group_id',
    objectIdStringSchema('resource_group_id', z.string()),
  ),
})

export { deployProjectResourceQuerySchema, deployProjectResourceBodySchema }

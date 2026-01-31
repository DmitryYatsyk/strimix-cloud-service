import { z } from 'zod'

const deployProjectResourcesSchema = z.object({
  projectId: z.coerce.number().int().positive(),
})

export { deployProjectResourcesSchema }

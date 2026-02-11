import { z, ZodError } from 'zod'
import { HttpException } from '@presentation/exceptions/http.exception.js'
import { ERRORS } from '@presentation/constants/errors.constants.js'
import { Types } from 'mongoose'

const validateReqBodySchema = (schema: z.ZodObject<any, any>, body: any) => {
  try {
    schema.parse(body)
  } catch (error) {
    if (error instanceof ZodError) {
      throw new HttpException({
        status: ERRORS.OTHER.REQUEST_VALIDATION_ERROR.status,
        code: ERRORS.OTHER.REQUEST_VALIDATION_ERROR.code,
        message: error.issues[0]?.message || 'Validation error',
      })
    } else {
      throw new HttpException(ERRORS.OTHER.INTERNAL_SERVER_ERROR)
    }
  }
}

const requiredField = <T extends z.ZodTypeAny>(fieldName: string, schema: T) => {
  return z.preprocess((val) => {
    if (val === undefined) {
      throw new z.ZodError([
        {
          code: 'custom',
          message: `Field "${fieldName}" is required`,
          path: [fieldName],
        },
      ])
    }
    return val
  }, schema)
}

const objectIdStringSchema = <T extends z.ZodTypeAny>(fieldName: string, schema: T) => {
  return z
    .string({ message: `"${fieldName}" must be a string` })
    .refine((val) => Types.ObjectId.isValid(val), {
      message: `"${fieldName}" must be a valid MongoDB ObjectId`,
      path: [fieldName],
    })
}

export { validateReqBodySchema, requiredField, objectIdStringSchema }

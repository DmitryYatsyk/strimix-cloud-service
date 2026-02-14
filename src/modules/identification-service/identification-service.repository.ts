import mongoose, { Document, Schema, model } from 'mongoose'
import { IIdentificationJob } from './identification-service.interface'

export interface IIdentificationJobDoc extends Document, Omit<IIdentificationJob, 'id'> {}

const IdentificationJobSchema = new Schema({
  project_id: { type: Number, required: true },
  is_running: { type: Boolean, required: true },
  status: { type: String, required: true },
  last_run: { type: Number, required: true },
  error_spec: { type: Object, required: false },
})

const IdentificationJobConn = mongoose.createConnection(
  process.env.IDENTITY_SERVICE_MONGO_CREDENTIALS as string,
)

const IdentificationJobRepository = IdentificationJobConn.model<IIdentificationJobDoc>(
  'identification_jobs',
  IdentificationJobSchema,
)

export { IdentificationJobRepository }

import { Document, Schema, model } from 'mongoose'
import { IProjectResources } from './project-resources.interface'

export interface IProjectResourcesDoc extends Document, Omit<IProjectResources, 'id'> {}

const ProjectResourcesSchema = new Schema(
  {
    project_id: { type: Number, required: true },
    stream_id: { type: String, required: true },
    gcloud_project_id: { type: String, default: null },
    bq_dataset_name: { type: String, default: null },
    bq_dataset_location: { type: String, default: null, enum: ['EU', 'US'] },
    pubsub_topic_id: { type: String, default: null },
    pubsub_event_processor_subscription_id: { type: String, default: null },
    pubsub_raw_events_subscription_id: { type: String, default: null },
    pubsub_bigquery_raw_events_subscription_id: { type: String, default: null },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    versionKey: false,
  },
)

const ProjectResourcesRepository = model<IProjectResourcesDoc>(
  'project_resources',
  ProjectResourcesSchema,
)

export { ProjectResourcesRepository }

import { IProjectConfig } from './project-config.interface.js'
import mongoose, { Document, Schema, model } from 'mongoose'

export interface IProjectConfigDoc extends Document, Omit<IProjectConfig, 'id'> {}

const ErrorSchema = new Schema(
  {
    type: { type: String, default: null },
    message: { type: String, default: null },
  },
  { _id: false },
)

const ProjectConfigSchema = new Schema(
  {
    project_id: { type: Number, required: true },
    unattributed_events_threshold: { type: Number, required: true },
    ignored_event_filters: { type: Array, required: true }, // Set empty array if no ignored event filters
    jobs: {
      type: new Schema(
        {
          check_unattributed_events_share: new Schema(
            {
              is_running: { type: Boolean, required: true, default: false },
              last_run: { type: Number, required: true, default: 0 },
              error_spec: ErrorSchema,
            },
            { _id: false },
          ),
          check_ad_costs_without_visits: new Schema(
            {
              is_running: { type: Boolean, required: true, default: false },
              last_run: { type: Number, required: true, default: 0 },
              error_spec: ErrorSchema,
            },
            { _id: false },
          ),
          calculate_events_attribution: new Schema(
            {
              is_running: { type: Boolean, required: true, default: false },
              last_run: { type: Number, required: true, default: 0 },
              error_spec: ErrorSchema,
            },
            { _id: false },
          ),
          update_facebook_ad_costs: new Schema(
            {
              is_running: { type: Boolean, required: true, default: false },
              last_run: { type: Number, required: true, default: 0 },
              error_spec: ErrorSchema,
            },
            { _id: false },
          ),
          update_google_ad_costs: new Schema(
            {
              is_running: { type: Boolean, required: true, default: false },
              last_run: { type: Number, required: true, default: 0 },
              error_spec: ErrorSchema,
            },
            { _id: false },
          ),
          update_tiktok_ad_costs: new Schema(
            {
              is_running: { type: Boolean, required: true, default: false },
              last_run: { type: Number, required: true, default: 0 },
              error_spec: ErrorSchema,
            },
            { _id: false },
          ),
          update_manual_ad_costs: new Schema(
            {
              is_running: { type: Boolean, required: true, default: false },
              last_run: { type: Number, required: true, default: 0 },
              error_spec: ErrorSchema,
            },
            { _id: false },
          ),
        },
        { _id: false },
      ),
      required: true,
      default: {
        check_unattributed_events_share: { is_running: false, last_run: 0 },
        check_ad_costs_without_visits: { is_running: false, last_run: 0 },
      },
    },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    versionKey: false,
  },
)

const ProjectConfigConn = mongoose.createConnection(
  process.env.DATA_PROCESSING_SERVICE_MONGO_CREDENTIALS as string,
)

const ProjectConfigRepository = ProjectConfigConn.model<IProjectConfigDoc>(
  'project_configs',
  ProjectConfigSchema,
)

export { ProjectConfigRepository }

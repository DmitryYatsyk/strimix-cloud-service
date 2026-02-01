import { Document, Schema, model } from 'mongoose'
import { IResourceGroup } from './resource-group.interface'

export interface IResourceGroupDoc extends Document, Omit<IResourceGroup, 'id'> {}

const ResourcesSchema = new Schema(
  {
    gcloud_project_id: { type: String, required: true },
  },
  { _id: false },
)

const ResourceGroupSchema = new Schema(
  {
    name: { type: String, required: true },
    description: { type: String, required: false },
    resources: { type: ResourcesSchema, required: true },
  },
  {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    versionKey: false,
  },
)

const ResourceGroupRepository = model<IResourceGroupDoc>('resource_groups', ResourceGroupSchema)

export { ResourceGroupRepository }

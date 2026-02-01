export interface IResources {
  gcloud_project_id: string
}

export interface IResourceGroup {
  id: number
  name: string
  description?: string
  resources: IResources
}

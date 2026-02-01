export interface IResources {
  gcloud_project_id: string
  gcloud_multi_region_location: 'EU' | 'US'
  gcloud_single_region_location: string
}

export interface IResourceGroup {
  id: number
  name: string
  description?: string
  resources: IResources
}

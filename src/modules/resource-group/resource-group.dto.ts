import { IResourceGroup, IResources } from './resource-group.interface'

class ResourceGroupDto implements IResourceGroup {
  id: number
  name: string
  description?: string
  resources: IResources

  constructor(resourceGroup: IResourceGroup) {
    this.id = resourceGroup.id
    this.name = resourceGroup.name
    this.description = resourceGroup.description
    this.resources = resourceGroup.resources
  }
}

export { ResourceGroupDto }

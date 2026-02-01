import {
  IResourceGroupDoc,
  ResourceGroupDto,
  ResourceGroupRepository,
} from '@modules/resource-group'

const getAvailableResourceGroups = async () => {
  const resourceGroups = await ResourceGroupRepository.find()
  return resourceGroups.map(
    (resourceGroup: IResourceGroupDoc) => new ResourceGroupDto(resourceGroup as any),
  )
}

export { getAvailableResourceGroups }

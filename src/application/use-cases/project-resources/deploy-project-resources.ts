import { ErrorNotificator } from '@application/providers/error-notificator'
import { ProjectDataProvider } from '@application/providers/project-data-provider'
import { IdentificationJobRepository } from '@modules/identification-service'
import { ResourceGroupRepository } from '@modules/resource-group'
import { ERRORS } from '@presentation/constants/errors.constants'
import { HttpException } from '@presentation/exceptions/http.exception'

const deployProjectResources = async (projectId: number, resourceGroupId: string) => {
  console.log('Deploying project resources for project ID:', projectId)

  // 1. Get resource group
  const resourceGroup = await ResourceGroupRepository.findById(resourceGroupId)
  if (!resourceGroup) {
    // Send error notification to technical support service
    await ErrorNotificator.collect({
      service_name: 'Cloud Service',
      project_id: projectId,
      error_name: 'Resource group not found',
      input_data: {
        project_id: projectId,
        resource_group_id: resourceGroupId,
      },
      error_data: {
        resource_group_id: resourceGroupId,
      },
    })

    throw new HttpException(ERRORS.RESOURCE_GROUP.NOT_FOUND)
  }

  // 2. Check if project exists
  const projectInfo = await ProjectDataProvider.getProjectInfo(projectId)
  if (!projectInfo) {
    // Send error notification to technical support service
    await ErrorNotificator.collect({
      service_name: 'Cloud Service',
      project_id: projectId,
      error_name: 'Project not found',
      input_data: {
        project_id: projectId,
      },
    })

    throw new HttpException(ERRORS.PROJECT.NOT_FOUND)
  }

  // 1. Create BigQuery Dataset

  // 2. Create BigQuery raw events table (for event log)

  // 3. Create BigQuery raw events table (for backup from pubsub)

  // 4. Create BigQuery identified events table

  // 5. Create BigQuery excluded referrers table

  // 6. Create BigQuery ad cost table

  // 7. Deploy GCloud PubSub Topic

  // 8. Deploy GCloud PubSub Raw Events Subscription (for event logs)

  // 9. Deploy GCloud PubSub BigQuery Raw Events Subscription

  // 10. Deploy GCloud PubSub Event Processor Subscription

  // 11. Create identification job in Identification Service
  await IdentificationJobRepository.create({
    project_id: projectId,
    is_running: false,
    status: 'ACTIVE',
    last_run: 0,
    error_spec: null,
  })

  // 12. Create attribution calculation job

  // 13. Create Facebook Ads ad cost calculation job

  // 14. Create Google Ads ad cost calculation job

  // 15. Create TikTok Ads ad cost calculation job

  return
}

export { deployProjectResources }

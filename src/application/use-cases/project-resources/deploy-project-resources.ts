import { ErrorNotificator } from '@application/providers/error-notificator'
import { ProjectDataProvider } from '@application/providers/project-data-provider'
import { IdentificationJobRepository } from '@modules/identification-service'
import { ResourceGroupRepository } from '@modules/resource-group'
import { ProjectResourcesRepository } from '@modules/project-resources'
import { ERRORS } from '@presentation/constants/errors.constants'
import { HttpException } from '@presentation/exceptions/http.exception'
import {
  AD_COSTS_TABLE_ID,
  AD_COSTS_TABLE_SCHEMA,
  BigQueryApi,
  EXCLUDED_REFERRERS_TABLE_ID,
  EXCLUDED_REFERRERS_TABLE_SCHEMA,
  EXCLUDED_REFERRERS_VIEW_QUERY,
  IDENTIFIED_EVENTS_TABLE_ID,
  IDENTIFIED_EVENTS_TABLE_SCHEMA,
} from '@modules/gcloud/bigquery'
import { RAW_EVENTS_TABLE_SCHEMA, RAW_EVENTS_TABLE_ID } from '@modules/gcloud/bigquery'

const deployProjectResources = async (projectId: number, resourceGroupId: string) => {
  try {
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

    // 3. Check if project has resources group
    let projectResources = await ProjectResourcesRepository.findOne({ project_id: projectId })
    if (!projectResources) {
      // Create project resources
      projectResources = await ProjectResourcesRepository.create({
        project_id: projectId,
        stream_id: projectInfo.streamId,
        gcloud_project_id: resourceGroup.resources.gcloud_project_id,
        bigquery: {
          dataset_id: null,
          dataset_location: null,
          raw_events_table_id: null,
          ad_costs_table_id: null,
          excluded_referrers_table_id: null,
          identified_events_table_id: null,
        },
        pubsub: {
          event_collector_topic_id: null,
          event_processor_subscription_id: null,
          bigquery_raw_events_subscription_id: null,
        },
      })
    }

    // 4. Create BigQuery API instance
    const bigqueryApi = new BigQueryApi({
      projectId: projectResources.gcloud_project_id,
      datasetLocation: resourceGroup.resources.gcloud_multi_region_location,
    })

    // 5. Create BigQuery Dataset
    if (!projectResources.bigquery.dataset_id) {
      projectResources.bigquery.dataset_id = `sx_${projectId}`
      projectResources.bigquery.dataset_location =
        resourceGroup.resources.gcloud_multi_region_location

      // Check if dataset exists
      const datasetExists = await bigqueryApi.datasetExists(projectResources.bigquery.dataset_id)

      if (!datasetExists) {
        await bigqueryApi.createDataset({
          projectId: projectResources.gcloud_project_id,
          datasetId: projectResources.bigquery.dataset_id,
          location: resourceGroup.resources.gcloud_multi_region_location,
        })
      }

      await projectResources.save()
    }

    // 6. Create BigQuery raw events table
    if (!projectResources.bigquery.raw_events_table_id) {
      const tableId = RAW_EVENTS_TABLE_ID

      const tableExists = await bigqueryApi.tableExists(
        projectResources.bigquery.dataset_id,
        tableId,
      )
      if (!tableExists) {
        await bigqueryApi.createTable({
          projectId: projectResources.gcloud_project_id,
          datasetId: projectResources.bigquery.dataset_id,
          tableId,
          schema: RAW_EVENTS_TABLE_SCHEMA,
          timePartitioning: {
            type: 'DAY',
            field: 'date',
            requirePartitionFilter: false,
          },
        })
      }

      projectResources.bigquery.raw_events_table_id = `${projectResources.gcloud_project_id}.${projectResources.bigquery.dataset_id}.${tableId}`
      await projectResources.save()
    }

    // 7. Create BigQuery identified events table
    if (!projectResources.bigquery.identified_events_table_id) {
      const tableId = IDENTIFIED_EVENTS_TABLE_ID

      const tableExists = await bigqueryApi.tableExists(
        projectResources.bigquery.dataset_id,
        tableId,
      )
      if (!tableExists) {
        await bigqueryApi.createTable({
          projectId: projectResources.gcloud_project_id,
          datasetId: projectResources.bigquery.dataset_id,
          tableId,
          schema: IDENTIFIED_EVENTS_TABLE_SCHEMA,
          timePartitioning: {
            type: 'DAY',
            field: 'date',
            requirePartitionFilter: false,
          },
        })
      }

      projectResources.bigquery.identified_events_table_id = `${projectResources.gcloud_project_id}.${projectResources.bigquery.dataset_id}.${tableId}`
      await projectResources.save()
    }

    // 8. Create BigQuery excluded referrers table
    if (!projectResources.bigquery.excluded_referrers_table_id) {
      const viewId = EXCLUDED_REFERRERS_TABLE_ID

      const tableExists = await bigqueryApi.tableExists(
        projectResources.bigquery.dataset_id,
        viewId,
      )
      if (!tableExists) {
        await bigqueryApi.createView({
          projectId: projectResources.gcloud_project_id,
          datasetId: projectResources.bigquery.dataset_id,
          viewId,
          query: EXCLUDED_REFERRERS_VIEW_QUERY,
        })
      }

      projectResources.bigquery.excluded_referrers_table_id = `${projectResources.gcloud_project_id}.${projectResources.bigquery.dataset_id}.${viewId}`
      await projectResources.save()
    }

    // 9. Create BigQuery ad cost table
    if (!projectResources.bigquery.ad_costs_table_id) {
      const tableId = AD_COSTS_TABLE_ID

      const tableExists = await bigqueryApi.tableExists(
        projectResources.bigquery.dataset_id,
        tableId,
      )
      if (!tableExists) {
        await bigqueryApi.createTable({
          projectId: projectResources.gcloud_project_id,
          datasetId: projectResources.bigquery.dataset_id,
          tableId,
          schema: AD_COSTS_TABLE_SCHEMA,
          timePartitioning: {
            type: 'DAY',
            field: 'date',
            requirePartitionFilter: false,
          },
        })
      }

      projectResources.bigquery.ad_costs_table_id = `${projectResources.gcloud_project_id}.${projectResources.bigquery.dataset_id}.${tableId}`
      await projectResources.save()
    }

    // 10. Deploy GCloud PubSub Topic

    // 11. Deploy GCloud PubSub BigQuery Raw Events Subscription

    // 12. Deploy GCloud PubSub Event Processor Subscription

    // 13. Create attribution calculation job

    // 14. Create Facebook Ads ad cost calculation job

    // 15. Create Google Ads ad cost calculation job

    // 16. Create TikTok Ads ad cost calculation job

    // 17. Create identification job in Identification Service
    // await IdentificationJobRepository.create({
    //   project_id: projectId,
    //   is_running: false,
    //   status: 'ACTIVE',
    //   last_run: 0,
    //   error_spec: null,
    // })

    return
  } catch (error) {
    console.log('error', error)
    await ErrorNotificator.collect({
      service_name: 'Cloud Service',
      project_id: projectId,
      error_name: 'Error deploying project resources',
      input_data: {
        project_id: projectId,
        resource_group_id: resourceGroupId,
      },
      error_data: {
        error: error,
      },
    })
    throw new HttpException(ERRORS.OTHER.INTERNAL_SERVER_ERROR)
  }
}

export { deployProjectResources }

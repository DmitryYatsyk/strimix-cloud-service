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
  EXCLUDED_REFERRERS_VIEW_QUERY,
  IDENTIFIED_EVENTS_TABLE_ID,
  IDENTIFIED_EVENTS_TABLE_SCHEMA,
} from '@modules/gcloud/bigquery'
import { RAW_EVENTS_TABLE_SCHEMA, RAW_EVENTS_TABLE_ID } from '@modules/gcloud/bigquery'
import {
  BIGQUERY_RAW_EVENTS_SUBSCRIPTION_ID_PREFIX,
  EVENT_COLLECTOR_TOPIC_ID_PREFIX,
  EVENT_PROCESSOR_SUBSCRIPTION_ID_PREFIX,
  PubSubApi,
} from '@modules/gcloud/pubsub'

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
        gcloud: {
          project_id: resourceGroup.resources.gcloud_project_id,
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
        },
        identification_service: {
          job_id: null,
        },
        data_processing_service: {
          project_config_id: null,
        },
      })
    }

    // 4. Create BigQuery API instance
    const bigqueryApi = new BigQueryApi({
      projectId: projectResources.gcloud.project_id,
      datasetLocation: resourceGroup.resources.gcloud_multi_region_location,
    })

    // 5. Create BigQuery Dataset
    if (!projectResources.gcloud.bigquery.dataset_id) {
      projectResources.gcloud.bigquery.dataset_id = `sx_${projectId}`
      projectResources.gcloud.bigquery.dataset_location =
        resourceGroup.resources.gcloud_multi_region_location

      // Check if dataset exists
      const datasetExists = await bigqueryApi.datasetExists(
        projectResources.gcloud.bigquery.dataset_id,
      )

      if (!datasetExists) {
        await bigqueryApi.createDataset({
          projectId: projectResources.gcloud.project_id,
          datasetId: projectResources.gcloud.bigquery.dataset_id,
          location: resourceGroup.resources.gcloud_multi_region_location,
        })
      }

      await projectResources.save()
    }

    // 6. Create BigQuery raw events table
    if (!projectResources.gcloud.bigquery.raw_events_table_id) {
      const tableId = RAW_EVENTS_TABLE_ID

      const tableExists = await bigqueryApi.tableExists(
        projectResources.gcloud.bigquery.dataset_id,
        tableId,
      )
      if (!tableExists) {
        await bigqueryApi.createTable({
          projectId: projectResources.gcloud.project_id,
          datasetId: projectResources.gcloud.bigquery.dataset_id,
          tableId,
          schema: RAW_EVENTS_TABLE_SCHEMA,
          timePartitioning: {
            type: 'DAY',
            field: 'date',
            requirePartitionFilter: false,
          },
        })
      }

      projectResources.gcloud.bigquery.raw_events_table_id = `${projectResources.gcloud.project_id}.${projectResources.gcloud.bigquery.dataset_id}.${tableId}`
      await projectResources.save()
    }

    // 7. Create BigQuery identified events table
    if (!projectResources.gcloud.bigquery.identified_events_table_id) {
      const tableId = IDENTIFIED_EVENTS_TABLE_ID

      const tableExists = await bigqueryApi.tableExists(
        projectResources.gcloud.bigquery.dataset_id,
        tableId,
      )
      if (!tableExists) {
        await bigqueryApi.createTable({
          projectId: projectResources.gcloud.project_id,
          datasetId: projectResources.gcloud.bigquery.dataset_id,
          tableId,
          schema: IDENTIFIED_EVENTS_TABLE_SCHEMA,
          timePartitioning: {
            type: 'DAY',
            field: 'date',
            requirePartitionFilter: false,
          },
        })
      }

      projectResources.gcloud.bigquery.identified_events_table_id = `${projectResources.gcloud.project_id}.${projectResources.gcloud.bigquery.dataset_id}.${tableId}`
      await projectResources.save()
    }

    // 8. Create BigQuery excluded referrers table
    if (!projectResources.gcloud.bigquery.excluded_referrers_table_id) {
      const viewId = EXCLUDED_REFERRERS_TABLE_ID

      const tableExists = await bigqueryApi.tableExists(
        projectResources.gcloud.bigquery.dataset_id,
        viewId,
      )
      if (!tableExists) {
        await bigqueryApi.createView({
          projectId: projectResources.gcloud.project_id,
          datasetId: projectResources.gcloud.bigquery.dataset_id,
          viewId,
          query: EXCLUDED_REFERRERS_VIEW_QUERY,
        })
      }

      projectResources.gcloud.bigquery.excluded_referrers_table_id = `${projectResources.gcloud.project_id}.${projectResources.gcloud.bigquery.dataset_id}.${viewId}`
      await projectResources.save()
    }

    // 9. Create BigQuery ad cost table
    if (!projectResources.gcloud.bigquery.ad_costs_table_id) {
      const tableId = AD_COSTS_TABLE_ID

      const tableExists = await bigqueryApi.tableExists(
        projectResources.gcloud.bigquery.dataset_id,
        tableId,
      )
      if (!tableExists) {
        await bigqueryApi.createTable({
          projectId: projectResources.gcloud.project_id,
          datasetId: projectResources.gcloud.bigquery.dataset_id,
          tableId,
          schema: AD_COSTS_TABLE_SCHEMA,
          timePartitioning: {
            type: 'DAY',
            field: 'date',
            requirePartitionFilter: false,
          },
        })
      }

      projectResources.gcloud.bigquery.ad_costs_table_id = `${projectResources.gcloud.project_id}.${projectResources.gcloud.bigquery.dataset_id}.${tableId}`
      await projectResources.save()
    }

    // 10. Create PubSub API instance
    const pubsubApi = new PubSubApi({ projectId: projectResources.gcloud.project_id })

    // 10. Deploy GCloud PubSub Topic
    if (!projectResources.gcloud.pubsub.event_collector_topic_id) {
      const topicId = `${EVENT_COLLECTOR_TOPIC_ID_PREFIX}_${projectId}`
      const topicExists = await pubsubApi.topicExists(topicId)
      if (!topicExists) {
        await pubsubApi.createTopic({
          projectId: projectResources.gcloud.project_id,
          topicId,
          messageRetentionDuration: 2678400, // 31 days
        })
      }

      projectResources.gcloud.pubsub.event_collector_topic_id = topicId
      await projectResources.save()
    }

    // 11. Deploy GCloud PubSub BigQuery Raw Events Subscription
    if (!projectResources.gcloud.pubsub.bigquery_raw_events_subscription_id) {
      const subscriptionId = `${BIGQUERY_RAW_EVENTS_SUBSCRIPTION_ID_PREFIX}_${projectId}`
      const subscriptionExists = await pubsubApi.subscriptionExists(subscriptionId)

      if (!subscriptionExists) {
        await pubsubApi.createBigQuerySubscription({
          projectId: projectResources.gcloud.project_id,
          topicId: projectResources.gcloud.pubsub.event_collector_topic_id,
          subscriptionId,
          bigqueryTable: projectResources.gcloud.bigquery.raw_events_table_id,
          writeMetadata: false,
          useTableSchema: true,
          dropUnknownFields: true,
          ackDeadlineSeconds: 60,
          messageRetentionDuration: 2678400, // 31 days
          retainAckedMessages: true,
          enableMessageOrdering: true,
          expirationNever: true,
        })
      }

      projectResources.gcloud.pubsub.bigquery_raw_events_subscription_id = subscriptionId
      await projectResources.save()
    }

    // 12. Deploy GCloud PubSub Event Processor Subscription
    if (!projectResources.gcloud.pubsub.event_processor_subscription_id) {
      const subscriptionId = `${EVENT_PROCESSOR_SUBSCRIPTION_ID_PREFIX}_${projectId}`
      const subscriptionExists = await pubsubApi.subscriptionExists(subscriptionId)
      if (!subscriptionExists) {
        await pubsubApi.createPullSubscription({
          projectId: projectResources.gcloud.project_id,
          topicId: projectResources.gcloud.pubsub.event_collector_topic_id,
          subscriptionId,
          ackDeadlineSeconds: 60,
          messageRetentionDuration: 2678400, // 31 days
          retainAckedMessages: true,
          enableMessageOrdering: true,
          expirationNever: true,
        })
      }

      projectResources.gcloud.pubsub.event_processor_subscription_id = subscriptionId
      await projectResources.save()
    }

    // 13.1 Create Facebook Ads ad cost table

    // 13.2 Create Facebook Ads ad cost update scheduled query

    // 14.1 Create Google Ads ad cost table

    // 14.2 Create Google Ads ad cost update scheduled query

    // 15.1 Create TikTok Ads ad cost table

    // 15.2 Create TikTok Ads ad cost update scheduled query

    // 16. Create identification job in Identification Service
    // await IdentificationJobRepository.create({
    //   project_id: projectId,
    //   is_running: false,
    //   status: 'ACTIVE',
    //   last_run: 0,
    //   error_spec: null,
    // })

    // 17. Create project config in data processing service

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

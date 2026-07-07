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
  GOOGLE_ADS_AD_COSTS_TABLE_ID,
  GOOGLE_ADS_AD_COSTS_TABLE_SCHEMA,
  IDENTIFIED_EVENTS_TABLE_ID,
  IDENTIFIED_EVENTS_TABLE_SCHEMA,
  PROFILE_MERGE_EVENTS_TABLE_ID,
  PROFILE_MERGE_EVENTS_TABLE_SCHEMA,
  FACEBOOK_ADS_AD_COSTS_TABLE_ID,
  FACEBOOK_ADS_AD_COSTS_TABLE_SCHEMA,
  TIKTOK_ADS_AD_COSTS_TABLE_SCHEMA,
  TIKTOK_ADS_AD_COSTS_TABLE_ID,
  RAW_EVENTS_TABLE_SCHEMA,
  RAW_EVENTS_TABLE_ID,
  CALCULATE_EVENTS_ATTRIBUTION_TEMPLATE,
  SCHEDULED_QUERY_CONFIGS,
  processScheduledQueryTemplate,
} from '@modules/gcloud/bigquery'
import {
  BIGQUERY_RAW_EVENTS_SUBSCRIPTION_ID_PREFIX,
  EVENT_COLLECTOR_TOPIC_ID_PREFIX,
  IDENTITY_SERVICE_SUBSCRIPTION_ID_PREFIX,
  PubSubApi,
} from '@modules/gcloud/pubsub'
import { ProjectConfigRepository as DataProcessingServiceProjectConfigRepository } from '@modules/data-processing-service/project-config'
import {
  UPDATE_FACEBOOK_ADS_AD_COSTS_TEMPLATE,
  UPDATE_GOOGLE_ADS_AD_COSTS_TEMPLATE,
  UPDATE_TIKTOK_ADS_AD_COSTS_TEMPLATE,
} from '@modules/gcloud/bigquery/scheduled-queries/templates'
import axios from 'axios'

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
      console.log('Project resources not found, creating project resources...')
      // Create project resources
      projectResources = await ProjectResourcesRepository.create({
        project_id: projectId,
        stream_id: projectInfo.streamId,
        gcloud: {
          project_id: resourceGroup.resources.gcloud_project_id,
          bigquery: {
            dataset: { id: null, location: null },
            tables: {
              raw_events: null,
              identified_events: null,
              profile_merge_events: null,
              excluded_referrers: null,
              ad_costs: null,
              facebook_ads_ad_costs: null,
              google_ads_ad_costs: null,
              tiktok_ads_ad_costs: null,
            },
            scheduled_queries: {
              calculate_events_attribution: null,
              facebook_ads_ad_costs_update: null,
              google_ads_ad_costs_update: null,
              tiktok_ads_ad_costs_update: null,
            },
          },
          pubsub: {
            topics: { event_collector: null },
            subscriptions: {
              bigquery_raw_events: null,
              identity_service: null,
            },
          },
        },
        identification_service: { job_id: null },
        data_processing_service: { project_config_id: null },
      })
    }

    const gcpProjectId = projectResources.gcloud.project_id
    const bq = projectResources.gcloud.bigquery
    const ps = projectResources.gcloud.pubsub

    // 4. Create BigQuery API instance
    const bigqueryApi = new BigQueryApi({
      projectId: gcpProjectId,
      datasetLocation: resourceGroup.resources.gcloud_multi_region_location,
    })

    // 5. Create BigQuery Dataset
    if (!bq.dataset.id) {
      bq.dataset.id = `sx_${projectId}`
      bq.dataset.location = resourceGroup.resources.gcloud_multi_region_location

      // Check if dataset exists
      const datasetExists = await bigqueryApi.datasetExists(bq.dataset.id)
      if (!datasetExists) {
        console.log('BigQuery dataset not found, creating dataset...')
        await bigqueryApi.createDataset({
          projectId: gcpProjectId,
          datasetId: bq.dataset.id,
          location: resourceGroup.resources.gcloud_multi_region_location,
        })
      }

      await projectResources.save()
    }

    const fullTableId = (tableId: string) => `${gcpProjectId}.${bq.dataset.id}.${tableId}`

    // 6. Create BigQuery raw events table
    if (!bq.tables.raw_events) {
      const tableId = RAW_EVENTS_TABLE_ID
      const tableExists = await bigqueryApi.tableExists(bq.dataset.id, tableId)
      if (!tableExists) {
        console.log('BigQuery raw events table not found, creating table...')
        await bigqueryApi.createTable({
          projectId: gcpProjectId,
          datasetId: bq.dataset.id,
          tableId,
          schema: RAW_EVENTS_TABLE_SCHEMA,
          timePartitioning: { type: 'DAY', field: 'date', requirePartitionFilter: false },
        })
      }

      bq.tables.raw_events = fullTableId(tableId)
      await projectResources.save()
    }

    // 7. Create BigQuery identified events table
    if (!bq.tables.identified_events) {
      const tableId = IDENTIFIED_EVENTS_TABLE_ID
      const tableExists = await bigqueryApi.tableExists(bq.dataset.id, tableId)
      if (!tableExists) {
        console.log('BigQuery identified events table not found, creating table...')
        await bigqueryApi.createTable({
          projectId: gcpProjectId,
          datasetId: bq.dataset.id,
          tableId,
          schema: IDENTIFIED_EVENTS_TABLE_SCHEMA,
          timePartitioning: { type: 'DAY', field: 'date', requirePartitionFilter: false },
        })
      }

      bq.tables.identified_events = fullTableId(tableId)
      await projectResources.save()
    }

    // 8. Create BigQuery profile merge events table
    if (!bq.tables.profile_merge_events) {
      const tableId = PROFILE_MERGE_EVENTS_TABLE_ID
      const tableExists = await bigqueryApi.tableExists(bq.dataset.id, tableId)
      if (!tableExists) {
        console.log('BigQuery profile merge events table not found, creating table...')
        await bigqueryApi.createTable({
          projectId: gcpProjectId,
          datasetId: bq.dataset.id,
          tableId,
          schema: PROFILE_MERGE_EVENTS_TABLE_SCHEMA,
          description:
            'Profile merge events. Source of truth for profile_id_mapping. Written by event-processing service instead of DML UPDATE.',
          timePartitioning: { type: 'DAY', field: 'date', requirePartitionFilter: false },
          clustering: { fields: ['merged_profile_id'] },
        })
      }

      bq.tables.profile_merge_events = fullTableId(tableId)
      await projectResources.save()
    }

    // 9. Create BigQuery excluded referrers view
    if (!bq.tables.excluded_referrers) {
      const viewId = EXCLUDED_REFERRERS_TABLE_ID
      const tableExists = await bigqueryApi.tableExists(bq.dataset.id, viewId)
      if (!tableExists) {
        console.log('BigQuery excluded referrers view not found, creating view...')
        await bigqueryApi.createView({
          projectId: gcpProjectId,
          datasetId: bq.dataset.id,
          viewId,
          query: EXCLUDED_REFERRERS_VIEW_QUERY,
        })
      }

      bq.tables.excluded_referrers = fullTableId(viewId)
      await projectResources.save()
    }

    // 10. Create BigQuery ad costs table
    if (!bq.tables.ad_costs) {
      const tableId = AD_COSTS_TABLE_ID
      const tableExists = await bigqueryApi.tableExists(bq.dataset.id, tableId)
      if (!tableExists) {
        console.log('BigQuery ad costs table not found, creating table...')
        await bigqueryApi.createTable({
          projectId: gcpProjectId,
          datasetId: bq.dataset.id,
          tableId,
          schema: AD_COSTS_TABLE_SCHEMA,
          timePartitioning: { type: 'DAY', field: 'date', requirePartitionFilter: false },
        })
      }

      bq.tables.ad_costs = fullTableId(tableId)
      await projectResources.save()
    }

    // 11. Create PubSub API instance
    const pubsubApi = new PubSubApi({ projectId: gcpProjectId })

    // 12. Deploy PubSub Topic
    if (!ps.topics.event_collector) {
      const topicId = `${EVENT_COLLECTOR_TOPIC_ID_PREFIX}_${projectId}`
      const topicExists = await pubsubApi.topicExists(topicId)
      if (!topicExists) {
        console.log('PubSub topic not found, creating topic...')
        await pubsubApi.createTopic({
          projectId: gcpProjectId,
          topicId,
          messageRetentionDuration: 2678400, // 31 days
        })
      }

      ps.topics.event_collector = topicId
      await projectResources.save()
    }

    // 13. Deploy PubSub BigQuery Raw Events Subscription
    if (!ps.subscriptions.bigquery_raw_events) {
      const subscriptionId = `${BIGQUERY_RAW_EVENTS_SUBSCRIPTION_ID_PREFIX}_${projectId}`
      const subscriptionExists = await pubsubApi.subscriptionExists(subscriptionId)
      if (!subscriptionExists) {
        console.log('PubSub BigQuery raw events subscription not found, creating subscription...')
        await pubsubApi.createBigQuerySubscription({
          projectId: gcpProjectId,
          topicId: ps.topics.event_collector,
          subscriptionId,
          bigqueryTable: bq.tables.raw_events,
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

      ps.subscriptions.bigquery_raw_events = subscriptionId
      await projectResources.save()
    }

    // 14. Deploy PubSub Identity Service Subscription
    if (!ps.subscriptions.identity_service) {
      const subscriptionId = `${IDENTITY_SERVICE_SUBSCRIPTION_ID_PREFIX}_${projectId}`
      const subscriptionExists = await pubsubApi.subscriptionExists(subscriptionId)
      if (!subscriptionExists) {
        console.log('PubSub identity service subscription not found, creating subscription...')
        await pubsubApi.createPullSubscription({
          projectId: gcpProjectId,
          topicId: ps.topics.event_collector,
          subscriptionId,
          ackDeadlineSeconds: 60,
          messageRetentionDuration: 2678400, // 31 days
          retainAckedMessages: true,
          enableMessageOrdering: true,
          expirationNever: true,
        })
      }

      ps.subscriptions.identity_service = subscriptionId
      await projectResources.save()
    }

    // 15.1 Create Facebook Ads ad costs table
    if (!bq.tables.facebook_ads_ad_costs) {
      const tableId = FACEBOOK_ADS_AD_COSTS_TABLE_ID
      const tableExists = await bigqueryApi.tableExists(bq.dataset.id, tableId)
      if (!tableExists) {
        console.log('Facebook Ads ad costs table not found, creating table...')
        await bigqueryApi.createTable({
          projectId: gcpProjectId,
          datasetId: bq.dataset.id,
          tableId,
          schema: FACEBOOK_ADS_AD_COSTS_TABLE_SCHEMA,
          timePartitioning: { type: 'DAY', field: 'date', requirePartitionFilter: false },
        })
      }

      bq.tables.facebook_ads_ad_costs = fullTableId(tableId)
      await projectResources.save()
    }

    // 15.2 Create Facebook Ads ad cost update scheduled query
    const facebookAdsConfig = SCHEDULED_QUERY_CONFIGS.facebookAdsAdCostsUpdate
    const facebookAdsDisplayName = facebookAdsConfig.displayNamePrefix.replace(
      '@PROJECT_ID',
      projectId.toString(),
    )
    const facebookAdsQueryResult =
      await bigqueryApi.findScheduledQueryByName(facebookAdsDisplayName)
    if (facebookAdsQueryResult.exists) {
      if (!bq.scheduled_queries.facebook_ads_ad_costs_update) {
        bq.scheduled_queries.facebook_ads_ad_costs_update = facebookAdsQueryResult.name!
        await projectResources.save()
      }
    } else {
      console.log('Creating Facebook Ads ad cost update scheduled query...')
      const facebookAdsQuery = processScheduledQueryTemplate(
        UPDATE_FACEBOOK_ADS_AD_COSTS_TEMPLATE,
        {
          projectName: gcpProjectId,
          datasetName: bq.dataset.id,
          projectTimezone: projectInfo.timezone,
        },
      )

      const created = await bigqueryApi.createScheduledQuery({
        displayName: facebookAdsDisplayName,
        query: facebookAdsQuery,
        schedule: facebookAdsConfig.schedule,
        location: bq.dataset.location!,
        startNow: true,
      })

      bq.scheduled_queries.facebook_ads_ad_costs_update = created.name
      await projectResources.save()
    }

    // 16.1 Create Google Ads ad costs table
    if (!bq.tables.google_ads_ad_costs) {
      const tableId = GOOGLE_ADS_AD_COSTS_TABLE_ID
      const tableExists = await bigqueryApi.tableExists(bq.dataset.id, tableId)
      if (!tableExists) {
        console.log('Google Ads ad costs table not found, creating table...')
        await bigqueryApi.createTable({
          projectId: gcpProjectId,
          datasetId: bq.dataset.id,
          tableId,
          schema: GOOGLE_ADS_AD_COSTS_TABLE_SCHEMA,
          timePartitioning: { type: 'DAY', field: 'date', requirePartitionFilter: false },
        })
      }

      bq.tables.google_ads_ad_costs = fullTableId(tableId)
      await projectResources.save()
    }

    // 16.2 Create Google Ads ad cost update scheduled query
    const googleAdsConfig = SCHEDULED_QUERY_CONFIGS.googleAdsAdCostsUpdate
    const googleAdsDisplayName = googleAdsConfig.displayNamePrefix.replace(
      '@PROJECT_ID',
      projectId.toString(),
    )
    const googleAdsQueryResult = await bigqueryApi.findScheduledQueryByName(googleAdsDisplayName)
    if (googleAdsQueryResult.exists) {
      if (!bq.scheduled_queries.google_ads_ad_costs_update) {
        bq.scheduled_queries.google_ads_ad_costs_update = googleAdsQueryResult.name!
        await projectResources.save()
      }
    } else {
      console.log('Creating Google Ads ad cost update scheduled query...')
      const googleAdsQuery = processScheduledQueryTemplate(UPDATE_GOOGLE_ADS_AD_COSTS_TEMPLATE, {
        projectName: gcpProjectId,
        datasetName: bq.dataset.id,
        projectTimezone: projectInfo.timezone,
      })

      const created = await bigqueryApi.createScheduledQuery({
        displayName: googleAdsDisplayName,
        query: googleAdsQuery,
        schedule: googleAdsConfig.schedule,
        location: bq.dataset.location!,
        startNow: true,
      })

      bq.scheduled_queries.google_ads_ad_costs_update = created.name
      await projectResources.save()
    }

    // 17.1 Create TikTok Ads ad costs table
    if (!bq.tables.tiktok_ads_ad_costs) {
      const tableId = TIKTOK_ADS_AD_COSTS_TABLE_ID
      const tableExists = await bigqueryApi.tableExists(bq.dataset.id, tableId)
      if (!tableExists) {
        console.log('TikTok Ads ad costs table not found, creating table...')
        await bigqueryApi.createTable({
          projectId: gcpProjectId,
          datasetId: bq.dataset.id,
          tableId,
          schema: TIKTOK_ADS_AD_COSTS_TABLE_SCHEMA,
          timePartitioning: { type: 'DAY', field: 'date', requirePartitionFilter: false },
        })
      }

      bq.tables.tiktok_ads_ad_costs = fullTableId(tableId)
      await projectResources.save()
    }

    // 17.2 Create TikTok Ads ad cost update scheduled query
    const tiktokAdsConfig = SCHEDULED_QUERY_CONFIGS.tiktokAdsAdCostsUpdate
    const tiktokAdsDisplayName = tiktokAdsConfig.displayNamePrefix.replace(
      '@PROJECT_ID',
      projectId.toString(),
    )
    const tiktokAdsQueryResult = await bigqueryApi.findScheduledQueryByName(tiktokAdsDisplayName)

    if (tiktokAdsQueryResult.exists) {
      if (!bq.scheduled_queries.tiktok_ads_ad_costs_update) {
        bq.scheduled_queries.tiktok_ads_ad_costs_update = tiktokAdsQueryResult.name!
        await projectResources.save()
      }
    } else {
      console.log('Creating TikTok Ads ad cost update scheduled query...')
      const tiktokAdsQuery = processScheduledQueryTemplate(UPDATE_TIKTOK_ADS_AD_COSTS_TEMPLATE, {
        projectName: gcpProjectId,
        datasetName: bq.dataset.id,
        projectTimezone: projectInfo.timezone,
      })

      const created = await bigqueryApi.createScheduledQuery({
        displayName: tiktokAdsDisplayName,
        query: tiktokAdsQuery,
        schedule: tiktokAdsConfig.schedule,
        location: bq.dataset.location!,
        startNow: true,
      })

      bq.scheduled_queries.tiktok_ads_ad_costs_update = created.name
      await projectResources.save()
    }

    // 18. Create attribution calculation scheduled query
    const attributionConfig = SCHEDULED_QUERY_CONFIGS.calculateEventsAttribution
    const attributionDisplayName = attributionConfig.displayNamePrefix.replace(
      '@PROJECT_ID',
      projectId.toString(),
    )
    const attributionQueryResult =
      await bigqueryApi.findScheduledQueryByName(attributionDisplayName)
    if (attributionQueryResult.exists) {
      if (!bq.scheduled_queries.calculate_events_attribution) {
        bq.scheduled_queries.calculate_events_attribution = attributionQueryResult.name!
        await projectResources.save()
      }
    } else {
      console.log('Creating attribution calculation scheduled query...')
      const attributionQuery = processScheduledQueryTemplate(
        CALCULATE_EVENTS_ATTRIBUTION_TEMPLATE,
        {
          projectName: gcpProjectId,
          datasetName: bq.dataset.id,
          projectTimezone: projectInfo.timezone,
        },
      )

      const created = await bigqueryApi.createScheduledQuery({
        displayName: attributionDisplayName,
        query: attributionQuery,
        schedule: attributionConfig.schedule,
        location: bq.dataset.location!,
        startNow: true,
      })

      bq.scheduled_queries.calculate_events_attribution = created.name
      await projectResources.save()
    }

    // 19. Create identification job in Identification Service
    let identificationJob = await IdentificationJobRepository.findOne({
      project_id: projectId,
    })
    if (!identificationJob) {
      identificationJob = await IdentificationJobRepository.create({
        project_id: projectId,
        is_running: false,
        status: 'ACTIVE',
        last_run: 0,
        error_spec: null,
      })

      projectResources.identification_service.job_id = identificationJob.id
      await projectResources.save()
    } else if (!projectResources.identification_service.job_id) {
      projectResources.identification_service.job_id = identificationJob.id
      await projectResources.save()
    }

    // 20. Create project config in data processing service
    let projectConfig = await DataProcessingServiceProjectConfigRepository.findOne({
      project_id: projectId,
    })
    if (!projectConfig) {
      console.log('Creating project config in data processing service...')
      projectConfig = await DataProcessingServiceProjectConfigRepository.create({
        project_id: projectId,
        unattributed_events_threshold: 1,
        ignored_event_filters: [],
        jobs: {
          check_unattributed_events_share: { is_running: false, last_run: 0 },
          check_ad_costs_without_visits: { is_running: false, last_run: 0 },
          calculate_events_attribution: { is_running: false, last_run: 0 },
          update_facebook_ad_costs: { is_running: false, last_run: 0 },
          update_google_ad_costs: { is_running: false, last_run: 0 },
          update_tiktok_ad_costs: { is_running: false, last_run: 0 },
          update_manual_ad_costs: { is_running: false, last_run: 0 },
        },
      })

      projectResources.data_processing_service.project_config_id = projectConfig.id
      await projectResources.save()
    } else if (!projectResources.data_processing_service.project_config_id) {
      projectResources.data_processing_service.project_config_id = projectConfig.id
      await projectResources.save()
    }

    // 21. Add project resources to API Gateway DB
    const apiGatewayURL =
      process.env.API_GATEWAY_HOST +
      '/api/v1/data-provider-for-cloud-service/create-project-dataset-config'

    const config = {
      method: 'post',
      url: apiGatewayURL,
      headers: {
        'content-type': 'application/json',
        authorization: process.env.API_GATEWAY_AUTHORIZATION_CODE,
      },
      data: {
        project_id: projectId,
        stream_id: projectInfo.streamId,
        gcloud: projectResources.gcloud,
      },
    }

    console.log('Adding project datasets config to API Gateway DB...')
    await axios(config)
      .then((response) => {
        return response.data
      })
      .catch((e) => {
        console.log(e)
        throw new HttpException(ERRORS.OTHER.INTERNAL_SERVER_ERROR)
      })

    console.log('Project cloud resources deployed successfully!')

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

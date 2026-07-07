export { BigQueryApi } from './api/bigquery.api'
export type {
  ICreateDatasetParams,
  ICreateTableParams,
  ICreateViewParams,
  ICreateScheduledQueryParams,
  IDatasetInfo,
  ITableInfo,
  IScheduledQueryInfo,
  MultiRegionLocation,
} from './bigquery.interface'
export {
  processScheduledQueryTemplate,
  CALCULATE_EVENTS_ATTRIBUTION_TEMPLATE,
  SCHEDULED_QUERY_CONFIGS,
} from './scheduled-queries/index'
export type {
  IScheduledQueryTemplateVariables,
  IScheduledQueryConfig,
} from './scheduled-queries/index'
export { RAW_EVENTS_TABLE_ID } from './schemas/v1/bigquery.raw_events.schema'
export { RAW_EVENTS_TABLE_SCHEMA } from './schemas/v1/bigquery.raw_events.schema'
export { IDENTIFIED_EVENTS_TABLE_ID } from './schemas/v1/bigquery.identified_events.schema'
export { IDENTIFIED_EVENTS_TABLE_SCHEMA } from './schemas/v1/bigquery.identified_events.schema'
export { EXCLUDED_REFERRERS_TABLE_ID } from './schemas/v1/bigquery.excluded_referrers.schema'
export { EXCLUDED_REFERRERS_TABLE_SCHEMA } from './schemas/v1/bigquery.excluded_referrers.schema'
export { EXCLUDED_REFERRERS_VIEW_QUERY } from './schemas/v1/bigquery.excluded_referrers.schema'
export { AD_COSTS_TABLE_ID } from './schemas/v1/bigquery.ad_costs.schema'
export { AD_COSTS_TABLE_SCHEMA } from './schemas/v1/bigquery.ad_costs.schema'
export { FACEBOOK_ADS_AD_COSTS_TABLE_ID } from './schemas/v1/bigquery.facebook_ads_ad_costs.schema'
export { FACEBOOK_ADS_AD_COSTS_TABLE_SCHEMA } from './schemas/v1/bigquery.facebook_ads_ad_costs.schema'
export { GOOGLE_ADS_AD_COSTS_TABLE_ID } from './schemas/v1/bigquery.google_ads_ad_costs.schema'
export { GOOGLE_ADS_AD_COSTS_TABLE_SCHEMA } from './schemas/v1/bigquery.google_ads_ad_costs.schema'
export { TIKTOK_ADS_AD_COSTS_TABLE_ID } from './schemas/v1/bigquery.tiktok_ads_ad_costs.schema'
export { TIKTOK_ADS_AD_COSTS_TABLE_SCHEMA } from './schemas/v1/bigquery.tiktok_ads_ad_costs.schema'
export { PROFILE_MERGE_EVENTS_TABLE_ID } from './schemas/v1/bigquery.profile_merge_events.schema'
export { PROFILE_MERGE_EVENTS_TABLE_SCHEMA } from './schemas/v1/bigquery.profile_merge_events.schema'

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
  WriteDisposition,
} from './bigquery.interface'
export { RAW_EVENTS_TABLE_ID } from './schemas/v1/bigquery.raw_events.schema'
export { RAW_EVENTS_TABLE_SCHEMA } from './schemas/v1/bigquery.raw_events.schema'
export { IDENTIFIED_EVENTS_TABLE_ID } from './schemas/v1/bigquery.identified_events.schema'
export { IDENTIFIED_EVENTS_TABLE_SCHEMA } from './schemas/v1/bigquery.identified_events.schema'
export { EXCLUDED_REFERRERS_TABLE_ID } from './schemas/v1/bigquery.excluded_referrers.schema'
export { EXCLUDED_REFERRERS_TABLE_SCHEMA } from './schemas/v1/bigquery.excluded_referrers.schema'
export { EXCLUDED_REFERRERS_VIEW_QUERY } from './schemas/v1/bigquery.excluded_referrers.schema'
export { AD_COSTS_TABLE_ID } from './schemas/v1/bigquery.ad_costs.schema'
export { AD_COSTS_TABLE_SCHEMA } from './schemas/v1/bigquery.ad_costs.schema'

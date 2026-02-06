import type { TableMetadata, TableField } from '@google-cloud/bigquery'

export type MultiRegionLocation = 'EU' | 'US'

export interface ICreateDatasetParams {
  projectId: string
  datasetId: string
  location: MultiRegionLocation
  description?: string
  defaultTableExpirationMs?: number
  labels?: Record<string, string>
}

export interface ICreateTableParams {
  projectId: string
  datasetId: string
  tableId: string
  schema: TableField[]
  description?: string
  timePartitioning?: {
    type: 'DAY' | 'HOUR' | 'MONTH' | 'YEAR'
    field?: string
    expirationMs?: number
  }
  clustering?: {
    fields: string[]
  }
  labels?: Record<string, string>
}

export interface ICreateViewParams {
  projectId: string
  datasetId: string
  viewId: string
  query: string
  description?: string
  useLegacySql?: boolean
  labels?: Record<string, string>
}

export type WriteDisposition = 'WRITE_TRUNCATE' | 'WRITE_APPEND' | 'WRITE_EMPTY'

export interface ICreateScheduledQueryParams {
  projectId: string
  location: MultiRegionLocation
  destinationDatasetId: string
  displayName: string
  query: string
  schedule: string
  destinationTableNameTemplate?: string
  writeDisposition?: WriteDisposition
  partitioningField?: string
  serviceAccountEmail?: string
}

export interface IDatasetInfo {
  id: string
  projectId: string
  location: string
  createdAt?: Date
}

export interface ITableInfo {
  id: string
  datasetId: string
  projectId: string
  createdAt?: Date
  type: 'TABLE' | 'VIEW' | 'EXTERNAL'
}

export interface IScheduledQueryInfo {
  name: string
  displayName: string
  destinationDatasetId: string
  schedule: string
  state: string
}

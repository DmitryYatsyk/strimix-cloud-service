import type { TableField } from '@google-cloud/bigquery'

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
    requirePartitionFilter?: boolean
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

export interface ICreateScheduledQueryParams {
  /** Optional. Omit for script queries (BEGIN/END, DML) - scripts cannot have destination table */
  datasetId?: string
  displayName: string
  query: string
  schedule: string
  /** BigQuery multi-region location (EU, US) - must match dataset location */
  location: MultiRegionLocation
  startNow?: boolean
  endTime?: Date
  disabled?: boolean
  serviceAccountName?: string
}

export interface IScheduledQueryInfo {
  name: string
  configId: string
  displayName: string
}

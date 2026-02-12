import { BigQuery, BigQueryOptions } from '@google-cloud/bigquery'
import { DataTransferServiceClient, protos } from '@google-cloud/bigquery-data-transfer'
import type {
  ICreateDatasetParams,
  ICreateTableParams,
  ICreateViewParams,
  ICreateScheduledQueryParams,
  IDatasetInfo,
  ITableInfo,
  IScheduledQueryInfo,
  MultiRegionLocation,
} from '../bigquery.interface'
import type { CredentialBody } from 'google-auth-library'

export class BigQueryApi {
  private readonly credentials: CredentialBody
  private readonly location: MultiRegionLocation
  private readonly options: BigQueryOptions
  private readonly bigquery: BigQuery
  // private readonly dataTransferClient: DataTransferServiceClient

  constructor({
    projectId,
    datasetLocation,
  }: {
    projectId: string
    datasetLocation: MultiRegionLocation
  }) {
    this.credentials = JSON.parse(process.env.GOOGLE_CLOUD_SERVICE_ACCOUNT as string)
    this.location = datasetLocation
    this.options = {
      credentials: this.credentials,
      projectId: projectId,
    }
    this.bigquery = new BigQuery(this.options)
    // this.dataTransferClient = new DataTransferServiceClient()
  }

  /**
   * Creates a new dataset in the specified multi-regional location
   * @param params - Dataset creation parameters
   * @returns Created dataset information
   */
  public async createDataset(params: ICreateDatasetParams): Promise<IDatasetInfo> {
    const { projectId, datasetId, location, description, defaultTableExpirationMs, labels } = params

    const dataset = this.bigquery.dataset(datasetId)

    await dataset.create({
      location,
      description,
      defaultTableExpirationMs: defaultTableExpirationMs?.toString(),
      labels,
    })

    const [metadata] = await dataset.getMetadata()

    return {
      id: dataset.id as string,
      projectId,
      location: metadata.location ?? location,
      createdAt: metadata.creationTime ? new Date(parseInt(metadata.creationTime)) : undefined,
    }
  }

  // /**
  //  * Creates a new table with the specified schema in a dataset
  //  * @param params - Table creation parameters
  //  * @returns Created table information
  //  */
  // public async createTable(params: ICreateTableParams): Promise<ITableInfo> {
  //   const {
  //     projectId,
  //     datasetId,
  //     tableId,
  //     schema,
  //     description,
  //     timePartitioning,
  //     clustering,
  //     labels,
  //   } = params

  //   const bigqueryClient = new BigQuery({ projectId })
  //   const dataset = bigqueryClient.dataset(datasetId)

  //   const options: Record<string, unknown> = {
  //     schema: {
  //       fields: schema,
  //     },
  //   }

  //   if (description) {
  //     options.description = description
  //   }

  //   if (timePartitioning) {
  //     options.timePartitioning = {
  //       type: timePartitioning.type,
  //       field: timePartitioning.field,
  //       expirationMs: timePartitioning.expirationMs,
  //     }
  //   }

  //   if (clustering) {
  //     options.clustering = {
  //       fields: clustering.fields,
  //     }
  //   }

  //   if (labels) {
  //     options.labels = labels
  //   }

  //   const [table] = await dataset.createTable(tableId, options)
  //   const metadata = await table.getMetadata()

  //   return {
  //     id: table.id as string,
  //     datasetId,
  //     projectId,
  //     createdAt: metadata[0].creationTime
  //       ? new Date(parseInt(metadata[0].creationTime))
  //       : undefined,
  //     type: 'TABLE',
  //   }
  // }

  // /**
  //  * Creates a new view in a dataset
  //  * @param params - View creation parameters
  //  * @returns Created view information
  //  */
  // public async createView(params: ICreateViewParams): Promise<ITableInfo> {
  //   const {
  //     projectId,
  //     datasetId,
  //     viewId,
  //     query,
  //     description,
  //     useLegacySql = false,
  //     labels,
  //   } = params

  //   const bigqueryClient = new BigQuery({ projectId })
  //   const dataset = bigqueryClient.dataset(datasetId)

  //   const options: Record<string, unknown> = {
  //     view: {
  //       query,
  //       useLegacySql,
  //     },
  //   }

  //   if (description) {
  //     options.description = description
  //   }

  //   if (labels) {
  //     options.labels = labels
  //   }

  //   const [view] = await dataset.createTable(viewId, options)
  //   const metadata = await view.getMetadata()

  //   return {
  //     id: view.id as string,
  //     datasetId,
  //     projectId,
  //     createdAt: metadata[0].creationTime
  //       ? new Date(parseInt(metadata[0].creationTime))
  //       : undefined,
  //     type: 'VIEW',
  //   }
  // }

  // /**
  //  * Creates a scheduled query job using BigQuery Data Transfer Service
  //  * @param params - Scheduled query creation parameters
  //  * @returns Created scheduled query information
  //  */
  // public async createScheduledQuery(
  //   params: ICreateScheduledQueryParams,
  // ): Promise<IScheduledQueryInfo> {
  //   const {
  //     projectId,
  //     location,
  //     destinationDatasetId,
  //     displayName,
  //     query,
  //     schedule,
  //     destinationTableNameTemplate,
  //     writeDisposition = 'WRITE_TRUNCATE',
  //     partitioningField = '',
  //     serviceAccountEmail,
  //   } = params

  //   const parent = `projects/${projectId}/locations/${location}`

  //   const transferConfig: protos.google.cloud.bigquery.datatransfer.v1.ITransferConfig = {
  //     destinationDatasetId,
  //     displayName,
  //     dataSourceId: 'scheduled_query',
  //     params: {
  //       fields: {
  //         query: { stringValue: query },
  //         write_disposition: { stringValue: writeDisposition },
  //         partitioning_field: { stringValue: partitioningField },
  //         ...(destinationTableNameTemplate && {
  //           destination_table_name_template: { stringValue: destinationTableNameTemplate },
  //         }),
  //       },
  //     },
  //     schedule,
  //   }

  //   const request: protos.google.cloud.bigquery.datatransfer.v1.ICreateTransferConfigRequest = {
  //     parent,
  //     transferConfig,
  //     ...(serviceAccountEmail && { serviceAccountName: serviceAccountEmail }),
  //   }

  //   const [response] = await this.dataTransferClient.createTransferConfig(request)

  //   return {
  //     name: response.name ?? '',
  //     displayName: response.displayName ?? displayName,
  //     destinationDatasetId: response.destinationDatasetId ?? destinationDatasetId,
  //     schedule: response.schedule ?? schedule,
  //     state: this.getTransferStateString(response.state),
  //   }
  // }

  /**
   * Checks if a dataset exists
   * @param projectId - GCP Project ID
   * @param datasetId - Dataset ID to check
   * @returns True if dataset exists, false otherwise
   */
  public async datasetExists(datasetId: string): Promise<boolean> {
    const [exists] = await this.bigquery.dataset(datasetId).exists()
    return exists
  }

  // /**
  //  * Checks if a table or view exists
  //  * @param projectId - GCP Project ID
  //  * @param datasetId - Dataset ID
  //  * @param tableId - Table or View ID to check
  //  * @returns True if table/view exists, false otherwise
  //  */
  // public async tableExists(
  //   projectId: string,
  //   datasetId: string,
  //   tableId: string,
  // ): Promise<boolean> {
  //   const bigqueryClient = new BigQuery({ projectId })

  //   try {
  //     const [exists] = await bigqueryClient.dataset(datasetId).table(tableId).exists()
  //     return exists
  //   } catch {
  //     return false
  //   }
  // }

  // /**
  //  * Deletes a dataset (optionally with all its contents)
  //  * @param projectId - GCP Project ID
  //  * @param datasetId - Dataset ID to delete
  //  * @param deleteContents - If true, deletes all tables in the dataset first
  //  */
  // public async deleteDataset(
  //   projectId: string,
  //   datasetId: string,
  //   deleteContents = false,
  // ): Promise<void> {
  //   const bigqueryClient = new BigQuery({ projectId })
  //   await bigqueryClient.dataset(datasetId).delete({ force: deleteContents })
  // }

  // /**
  //  * Deletes a table or view
  //  * @param projectId - GCP Project ID
  //  * @param datasetId - Dataset ID
  //  * @param tableId - Table or View ID to delete
  //  */
  // public async deleteTable(projectId: string, datasetId: string, tableId: string): Promise<void> {
  //   const bigqueryClient = new BigQuery({ projectId })
  //   await bigqueryClient.dataset(datasetId).table(tableId).delete()
  // }

  // /**
  //  * Deletes a scheduled query
  //  * @param transferConfigName - Full resource name of the transfer config
  //  */
  // public async deleteScheduledQuery(transferConfigName: string): Promise<void> {
  //   await this.dataTransferClient.deleteTransferConfig({ name: transferConfigName })
  // }

  // /**
  //  * Lists all datasets in a project
  //  * @param projectId - GCP Project ID
  //  * @returns Array of dataset information
  //  */
  // public async listDatasets(projectId: string): Promise<IDatasetInfo[]> {
  //   const bigqueryClient = new BigQuery({ projectId })
  //   const [datasets] = await bigqueryClient.getDatasets()

  //   return datasets.map((dataset) => ({
  //     id: dataset.id as string,
  //     projectId,
  //     location: '',
  //   }))
  // }

  // /**
  //  * Lists all tables and views in a dataset
  //  * @param projectId - GCP Project ID
  //  * @param datasetId - Dataset ID
  //  * @returns Array of table/view information
  //  */
  // public async listTables(projectId: string, datasetId: string): Promise<ITableInfo[]> {
  //   const bigqueryClient = new BigQuery({ projectId })
  //   const [tables] = await bigqueryClient.dataset(datasetId).getTables()

  //   return Promise.all(
  //     tables.map(async (table) => {
  //       const [metadata] = await table.getMetadata()
  //       return {
  //         id: table.id as string,
  //         datasetId,
  //         projectId,
  //         type: metadata.type as 'TABLE' | 'VIEW' | 'EXTERNAL',
  //       }
  //     }),
  //   )
  // }

  // /**
  //  * Lists all scheduled queries in a project/location
  //  * @param projectId - GCP Project ID
  //  * @param location - Location (e.g., 'US', 'EU')
  //  * @returns Array of scheduled query information
  //  */
  // public async listScheduledQueries(
  //   projectId: string,
  //   location: string,
  // ): Promise<IScheduledQueryInfo[]> {
  //   const parent = `projects/${projectId}/locations/${location}`

  //   const [transferConfigs] = await this.dataTransferClient.listTransferConfigs({
  //     parent,
  //     dataSourceIds: ['scheduled_query'],
  //   })

  //   return transferConfigs.map((config) => ({
  //     name: config.name ?? '',
  //     displayName: config.displayName ?? '',
  //     destinationDatasetId: config.destinationDatasetId ?? '',
  //     schedule: config.schedule ?? '',
  //     state: this.getTransferStateString(config.state),
  //   }))
  // }

  // /**
  //  * Converts transfer state enum to string representation
  //  */
  // private getTransferStateString(
  //   state:
  //     | protos.google.cloud.bigquery.datatransfer.v1.TransferState
  //     | keyof typeof protos.google.cloud.bigquery.datatransfer.v1.TransferState
  //     | null
  //     | undefined,
  // ): string {
  //   if (state === null || state === undefined) {
  //     return 'UNSPECIFIED'
  //   }

  //   if (typeof state === 'string') {
  //     return state
  //   }

  //   const TransferState = protos.google.cloud.bigquery.datatransfer.v1.TransferState

  //   switch (state) {
  //     case TransferState.PENDING:
  //       return 'PENDING'
  //     case TransferState.RUNNING:
  //       return 'RUNNING'
  //     case TransferState.SUCCEEDED:
  //       return 'SUCCEEDED'
  //     case TransferState.FAILED:
  //       return 'FAILED'
  //     case TransferState.CANCELLED:
  //       return 'CANCELLED'
  //     default:
  //       return 'UNSPECIFIED'
  //   }
  // }
}

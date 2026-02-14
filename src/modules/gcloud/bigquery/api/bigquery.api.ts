import { BigQuery, BigQueryOptions } from '@google-cloud/bigquery'
import type {
  ICreateDatasetParams,
  ICreateTableParams,
  ICreateViewParams,
  IDatasetInfo,
  ITableInfo,
  MultiRegionLocation,
} from '../bigquery.interface'
import type { CredentialBody } from 'google-auth-library'
import { DataTransferServiceClient } from '@google-cloud/bigquery-data-transfer'

export class BigQueryApi {
  private readonly credentials: CredentialBody
  private readonly location: MultiRegionLocation
  private readonly bigquery: BigQuery
  private readonly bqTransfer: DataTransferServiceClient
  private readonly projectId: string

  constructor({
    projectId,
    datasetLocation,
  }: {
    projectId: string
    datasetLocation: MultiRegionLocation
  }) {
    this.credentials = JSON.parse(process.env.GOOGLE_CLOUD_SERVICE_ACCOUNT as string)
    this.location = datasetLocation
    this.projectId = projectId
    this.bigquery = new BigQuery({
      credentials: this.credentials,
      projectId: projectId,
    })
    this.bqTransfer = new DataTransferServiceClient({
      credentials: this.credentials,
      projectId: projectId,
    })
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

  /**
   * Creates a new table with the specified schema in a dataset
   * @param params - Table creation parameters
   * @returns Created table information
   */
  public async createTable(params: ICreateTableParams): Promise<ITableInfo> {
    const {
      projectId,
      datasetId,
      tableId,
      schema,
      description,
      timePartitioning,
      clustering,
      labels,
    } = params

    const dataset = this.bigquery.dataset(datasetId)

    const options: Record<string, unknown> = {
      schema: {
        fields: schema,
      },
    }

    if (description) {
      options.description = description
    }

    if (timePartitioning) {
      options.timePartitioning = {
        type: timePartitioning.type,
        field: timePartitioning.field,
        expirationMs: timePartitioning.expirationMs,
      }
      if (typeof timePartitioning.requirePartitionFilter !== 'undefined') {
        options.requirePartitionFilter = timePartitioning.requirePartitionFilter
      }
    }

    if (clustering) {
      options.clustering = {
        fields: clustering.fields,
      }
    }

    if (labels) {
      options.labels = labels
    }

    const [table] = await dataset.createTable(tableId, options)
    const metadata = await table.getMetadata()

    return {
      id: table.id as string,
      datasetId,
      projectId,
      createdAt: metadata[0].creationTime
        ? new Date(parseInt(metadata[0].creationTime))
        : undefined,
      type: 'TABLE',
    }
  }

  /**
   * Creates a new view in a dataset
   * @param params - View creation parameters
   * @returns Created view information
   */
  public async createView(params: ICreateViewParams): Promise<ITableInfo> {
    const {
      projectId,
      datasetId,
      viewId,
      query,
      description,
      useLegacySql = false,
      labels,
    } = params

    const dataset = this.bigquery.dataset(datasetId)

    const options: Record<string, unknown> = {
      view: {
        query,
        useLegacySql,
      },
    }

    if (description) {
      options.description = description
    }

    if (labels) {
      options.labels = labels
    }

    const [view] = await dataset.createTable(viewId, options)
    const metadata = await view.getMetadata()

    return {
      id: view.id as string,
      datasetId,
      projectId,
      createdAt: metadata[0].creationTime
        ? new Date(parseInt(metadata[0].creationTime))
        : undefined,
      type: 'VIEW',
    }
  }

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

  /**
   * Checks if a table or view exists
   * @param datasetId - Dataset ID
   * @param tableId - Table or View ID to check
   * @returns True if table/view exists, false otherwise
   */
  public async tableExists(datasetId: string, tableId: string): Promise<boolean> {
    const [exists] = await this.bigquery.dataset(datasetId).table(tableId).exists()
    return exists
  }

  /**
   * Finds Scheduled Query by displayName
   * Prevents duplicate creation
   */
  public async findScheduledQueryByName(displayName: string): Promise<{
    exists: boolean
    configId?: string
    name?: string
  }> {
    const parent = `projects/${this.projectId}/locations/${this.location}`

    const [configs] = await this.bqTransfer.listTransferConfigs({ parent })
    const found = configs.find((config) => config.displayName === displayName)
    if (found && found.name) {
      return {
        exists: true,
        name: found.name,
        configId: found.name.split('/').pop(),
      }
    }

    return { exists: false }
  }

  /**
   * Creates a Scheduled Query (TransferConfig)
   * @returns Created config info (resource name + configId)
   */
  public async createScheduledQuery(params: {
    datasetId: string
    displayName: string
    query: string
    schedule?: string // e.g. "every 24 hours"
    destinationTableNameTemplate?: string // e.g. "events_{run_date}"
    writeDisposition?: 'WRITE_TRUNCATE' | 'WRITE_APPEND' | 'WRITE_EMPTY'
    partitioningField?: string // optional
    serviceAccountName?: string // optional: run as SA (recommended in prod)
    disabled?: boolean
  }): Promise<{ name: string; configId: string }> {
    const {
      datasetId,
      displayName,
      query,
      schedule = 'every 24 hours',
      destinationTableNameTemplate = 'scheduled_{run_date}',
      writeDisposition = 'WRITE_TRUNCATE',
      partitioningField = '',
      serviceAccountName,
      disabled = false,
    } = params

    const parent = `projects/${this.projectId}/locations/${this.location}`

    const transferConfig: any = {
      destinationDatasetId: datasetId,
      displayName,
      dataSourceId: 'scheduled_query',
      schedule,
      disabled,
      params: {
        query,
        destination_table_name_template: destinationTableNameTemplate,
        write_disposition: writeDisposition,
        partitioning_field: partitioningField, // empty string = no partitioning
      },
    }

    const request: any = { parent, transferConfig }
    if (serviceAccountName) request.serviceAccountName = serviceAccountName

    const [config] = await this.bqTransfer.createTransferConfig(request)

    const name = config.name as string
    const configId = name.split('/').pop() as string

    return { name, configId }
  }
}

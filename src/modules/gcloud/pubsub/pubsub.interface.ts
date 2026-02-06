import type { google } from '@google-cloud/pubsub/build/protos/protos'

export interface ICreateTopicParams {
  projectId: string
  topicId: string
  labels?: Record<string, string>
  /** KMS key name for message encryption */
  kmsKeyName?: string
  /** Schema settings for topic messages */
  schemaSettings?: {
    schema: string
    encoding: 'JSON' | 'BINARY'
  }
  /** Message retention duration in seconds (min: 600s = 10min, max: 604800s = 7 days) */
  messageRetentionDuration?: number
}

export interface ICreatePullSubscriptionParams {
  projectId: string
  topicId: string
  subscriptionId: string
  /** Acknowledge deadline in seconds (10-600, default: 10) */
  ackDeadlineSeconds?: number
  /** Message retention duration in seconds (min: 600s = 10min, max: 604800s = 7 days) */
  messageRetentionDuration?: number
  /** Retain acknowledged messages (default: false) */
  retainAckedMessages?: boolean
  /** Enable message ordering by ordering key (default: false) */
  enableMessageOrdering?: boolean
  /** Enable exactly once delivery (default: false) */
  enableExactlyOnceDelivery?: boolean
  /** Filter expression for messages */
  filter?: string
  /** Dead letter policy configuration */
  deadLetterPolicy?: {
    deadLetterTopic: string
    maxDeliveryAttempts: number
  }
  /** Retry policy configuration */
  retryPolicy?: {
    minimumBackoffSeconds: number
    maximumBackoffSeconds: number
  }
  /** Expiration policy - subscription expires after this inactivity period (in seconds) */
  expirationTtlSeconds?: number
  labels?: Record<string, string>
}

export interface ICreateBigQuerySubscriptionParams {
  projectId: string
  topicId: string
  subscriptionId: string
  /** BigQuery table in format: project_id.dataset_id.table_id */
  bigqueryTable: string
  /** Write message metadata to BigQuery (default: true) */
  writeMetadata?: boolean
  /** Drop unknown fields when writing to BigQuery (default: false) */
  dropUnknownFields?: boolean
  /** Use topic schema for BigQuery table (default: false) */
  useTopicSchema?: boolean
  /** Use table schema for validation (default: false) */
  useTableSchema?: boolean
  /** Acknowledge deadline in seconds (10-600, default: 10) */
  ackDeadlineSeconds?: number
  /** Message retention duration in seconds */
  messageRetentionDuration?: number
  /** Retain acknowledged messages (default: false) */
  retainAckedMessages?: boolean
  /** Enable message ordering by ordering key (default: false) */
  enableMessageOrdering?: boolean
  /** Filter expression for messages */
  filter?: string
  /** Dead letter policy configuration */
  deadLetterPolicy?: {
    deadLetterTopic: string
    maxDeliveryAttempts: number
  }
  /** Retry policy configuration */
  retryPolicy?: {
    minimumBackoffSeconds: number
    maximumBackoffSeconds: number
  }
  labels?: Record<string, string>
}

export interface ITopicInfo {
  name: string
  projectId: string
  topicId: string
  labels?: Record<string, string>
}

export interface ISubscriptionInfo {
  name: string
  projectId: string
  subscriptionId: string
  topicName: string
  type: 'PULL' | 'PUSH' | 'BIGQUERY'
  ackDeadlineSeconds: number
  messageRetentionDuration?: string
  enableMessageOrdering: boolean
  labels?: Record<string, string>
}

export type SubscriptionState = google.pubsub.v1.Subscription.State

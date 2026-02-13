import { PubSub, Topic, Subscription, v1 } from '@google-cloud/pubsub'
import type { CreateSubscriptionOptions } from '@google-cloud/pubsub'
import type {
  ICreateTopicParams,
  ICreatePullSubscriptionParams,
  ICreateBigQuerySubscriptionParams,
  ITopicInfo,
  ISubscriptionInfo,
} from './pubsub.interface'
import type { CredentialBody } from 'google-auth-library'
export class PubSubApi {
  private readonly credentials: CredentialBody
  private readonly pubsub: PubSub

  constructor({ projectId }: { projectId: string }) {
    this.credentials = JSON.parse(process.env.GOOGLE_CLOUD_SERVICE_ACCOUNT as string)
    this.pubsub = new PubSub({ credentials: this.credentials, projectId })
  }

  /**
   * Converts seconds to Duration format string (e.g., "3600s")
   */
  private secondsToDuration(seconds: number): string {
    return `${seconds}s`
  }

  // ============================================
  // TOPIC OPERATIONS
  // ============================================

  /**
   * Creates a new Pub/Sub topic
   * @param params - Topic creation parameters
   * @returns Created topic information
   */
  public async createTopic(params: ICreateTopicParams): Promise<ITopicInfo> {
    const { projectId, topicId, labels, kmsKeyName, schemaSettings, messageRetentionDuration } =
      params

    const publisherClient = new v1.PublisherClient({
      credentials: this.credentials,
      projectId,
    })
    const name = `projects/${projectId}/topics/${topicId}`
    const [topic] = await publisherClient.createTopic({
      name,
      labels,
      kmsKeyName,
      schemaSettings: schemaSettings
        ? {
            schema: schemaSettings.schema,
            encoding: schemaSettings.encoding,
          }
        : undefined,
      messageRetentionDuration: messageRetentionDuration
        ? {
            seconds: messageRetentionDuration,
            nanos: 0,
          }
        : undefined,
    })

    return {
      name: topic.name ?? name,
      projectId,
      topicId,
      labels,
    }
  }

  /**
   * Checks if a topic exists
   * @param topicId - Topic ID
   * @returns True if topic exists
   */
  public async topicExists(topicId: string): Promise<boolean> {
    const [exists] = await this.pubsub.topic(topicId).exists()
    return exists
  }

  // ============================================
  // PULL SUBSCRIPTION OPERATIONS
  // ============================================

  /**
   * Creates a Pull subscription with all configurable options
   * @param params - Subscription creation parameters
   * @returns Created subscription information
   */
  public async createPullSubscription(
    params: ICreatePullSubscriptionParams,
  ): Promise<ISubscriptionInfo> {
    const {
      projectId,
      topicId,
      subscriptionId,
      ackDeadlineSeconds = 10,
      messageRetentionDuration,
      retainAckedMessages = false,
      enableMessageOrdering = false,
      enableExactlyOnceDelivery = false,
      filter,
      deadLetterPolicy,
      retryPolicy,
      expirationTtlSeconds,
      labels,
      expirationNever,
    } = params

    const topic = this.pubsub.topic(topicId)

    const options: CreateSubscriptionOptions = {
      ackDeadlineSeconds,
      retainAckedMessages,
      enableMessageOrdering,
      enableExactlyOnceDelivery,
    }

    if (messageRetentionDuration) {
      options.messageRetentionDuration = {
        seconds: messageRetentionDuration,
        nanos: 0,
      }
    }

    if (expirationNever) {
      options.expirationPolicy = {} as unknown as {
        ttl?: {
          seconds: number
          nanos: number
        }
      }
    } else if (expirationTtlSeconds) {
      options.expirationPolicy = {
        ttl: {
          seconds: expirationTtlSeconds,
          nanos: 0,
        },
      }
    }

    if (filter) {
      options.filter = filter
    }

    if (deadLetterPolicy) {
      const deadLetterTopicName = `projects/${projectId}/topics/${deadLetterPolicy.deadLetterTopic}`
      options.deadLetterPolicy = {
        deadLetterTopic: deadLetterTopicName,
        maxDeliveryAttempts: deadLetterPolicy.maxDeliveryAttempts,
      }
    }

    if (retryPolicy) {
      options.retryPolicy = {
        minimumBackoff: {
          seconds: retryPolicy.minimumBackoffSeconds,
          nanos: 0,
        },
        maximumBackoff: {
          seconds: retryPolicy.maximumBackoffSeconds,
          nanos: 0,
        },
      }
    }

    if (expirationTtlSeconds) {
      options.expirationPolicy = {
        ttl: {
          seconds: expirationTtlSeconds,
          nanos: 0,
        },
      }
    }

    if (labels) {
      options.labels = labels
    }

    const [subscription] = await topic.createSubscription(subscriptionId, options)

    return {
      name: subscription.name,
      projectId,
      subscriptionId,
      topicName: topic.name,
      type: 'PULL',
      ackDeadlineSeconds,
      messageRetentionDuration: messageRetentionDuration
        ? this.secondsToDuration(messageRetentionDuration)
        : undefined,
      enableMessageOrdering,
      labels,
    }
  }

  // ============================================
  // BIGQUERY SUBSCRIPTION OPERATIONS
  // ============================================

  /**
   * Creates a BigQuery subscription that writes messages directly to a BigQuery table
   * @param params - BigQuery subscription creation parameters
   * @returns Created subscription information
   */
  public async createBigQuerySubscription(
    params: ICreateBigQuerySubscriptionParams,
  ): Promise<ISubscriptionInfo> {
    const {
      projectId,
      topicId,
      subscriptionId,
      bigqueryTable,
      writeMetadata = true,
      dropUnknownFields = false,
      useTopicSchema = false,
      useTableSchema = false,
      ackDeadlineSeconds = 10,
      messageRetentionDuration,
      expirationTtlSeconds,
      expirationNever,
      retainAckedMessages = false,
      enableMessageOrdering = false,
      filter,
      deadLetterPolicy,
      retryPolicy,
      labels,
    } = params

    const topic = this.pubsub.topic(topicId)

    const options: CreateSubscriptionOptions = {
      bigqueryConfig: {
        table: bigqueryTable,
        writeMetadata,
        dropUnknownFields,
        useTopicSchema,
        useTableSchema,
      },
      ackDeadlineSeconds,
      retainAckedMessages,
      enableMessageOrdering,
    }

    if (messageRetentionDuration) {
      options.messageRetentionDuration = {
        seconds: messageRetentionDuration,
        nanos: 0,
      }
    }

    if (expirationNever) {
      options.expirationPolicy = {} as unknown as {
        ttl?: {
          seconds: number
          nanos: number
        }
      }
    } else if (expirationTtlSeconds) {
      options.expirationPolicy = {
        ttl: {
          seconds: expirationTtlSeconds,
          nanos: 0,
        },
      } as unknown as {
        ttl?: {
          seconds: number
          nanos: number
        }
      }
    }

    if (filter) {
      options.filter = filter
    }

    if (deadLetterPolicy) {
      const deadLetterTopicName = `projects/${projectId}/topics/${deadLetterPolicy.deadLetterTopic}`
      options.deadLetterPolicy = {
        deadLetterTopic: deadLetterTopicName,
        maxDeliveryAttempts: deadLetterPolicy.maxDeliveryAttempts,
      }
    }

    if (retryPolicy) {
      options.retryPolicy = {
        minimumBackoff: {
          seconds: retryPolicy.minimumBackoffSeconds,
          nanos: 0,
        },
        maximumBackoff: {
          seconds: retryPolicy.maximumBackoffSeconds,
          nanos: 0,
        },
      }
    }

    if (labels) {
      options.labels = labels
    }

    const [subscription] = await topic.createSubscription(subscriptionId, options)

    return {
      name: subscription.name,
      projectId,
      subscriptionId,
      topicName: topic.name,
      type: 'BIGQUERY',
      ackDeadlineSeconds,
      messageRetentionDuration: messageRetentionDuration
        ? this.secondsToDuration(messageRetentionDuration)
        : undefined,
      enableMessageOrdering,
      labels,
    }
  }

  // ============================================
  // SUBSCRIPTION COMMON OPERATIONS
  // ============================================

  /**
   * Checks if a subscription exists
   * @param projectId - GCP Project ID
   * @param subscriptionId - Subscription ID
   * @returns True if subscription exists
   */
  public async subscriptionExists(subscriptionId: string): Promise<boolean> {
    const [exists] = await this.pubsub.subscription(subscriptionId).exists()
    return exists
  }
}

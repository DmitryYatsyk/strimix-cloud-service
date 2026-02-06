import { PubSub, Topic, Subscription } from '@google-cloud/pubsub'
import type { CreateSubscriptionOptions } from '@google-cloud/pubsub'
import type {
  ICreateTopicParams,
  ICreatePullSubscriptionParams,
  ICreateBigQuerySubscriptionParams,
  ITopicInfo,
  ISubscriptionInfo,
} from './pubsub.interface'

export class PubSubApi {
  private readonly defaultPubSub: PubSub

  constructor() {
    this.defaultPubSub = new PubSub()
  }

  /**
   * Gets a PubSub client for a specific project
   */
  private getClient(projectId: string): PubSub {
    return new PubSub({ projectId })
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

    const client = this.getClient(projectId)

    const topicOptions: Record<string, unknown> = {}

    if (labels) {
      topicOptions.labels = labels
    }

    if (kmsKeyName) {
      topicOptions.kmsKeyName = kmsKeyName
    }

    if (schemaSettings) {
      topicOptions.schemaSettings = {
        schema: schemaSettings.schema,
        encoding: schemaSettings.encoding,
      }
    }

    if (messageRetentionDuration) {
      topicOptions.messageRetentionDuration = {
        seconds: messageRetentionDuration,
      }
    }

    const [topic] = await client.createTopic({
      name: topicId,
      ...topicOptions,
    })

    return {
      name: topic.name,
      projectId,
      topicId,
      labels,
    }
  }

  /**
   * Checks if a topic exists
   * @param projectId - GCP Project ID
   * @param topicId - Topic ID
   * @returns True if topic exists
   */
  public async topicExists(projectId: string, topicId: string): Promise<boolean> {
    const client = this.getClient(projectId)

    try {
      const [exists] = await client.topic(topicId).exists()
      return exists
    } catch {
      return false
    }
  }

  /**
   * Gets topic information
   * @param projectId - GCP Project ID
   * @param topicId - Topic ID
   * @returns Topic information
   */
  public async getTopic(projectId: string, topicId: string): Promise<ITopicInfo> {
    const client = this.getClient(projectId)
    const topic = client.topic(topicId)
    const [metadata] = await topic.getMetadata()

    return {
      name: metadata.name ?? topic.name,
      projectId,
      topicId,
      labels: metadata.labels as Record<string, string> | undefined,
    }
  }

  /**
   * Lists all topics in a project
   * @param projectId - GCP Project ID
   * @returns Array of topic information
   */
  public async listTopics(projectId: string): Promise<ITopicInfo[]> {
    const client = this.getClient(projectId)
    const [topics] = await client.getTopics()

    return topics.map((topic) => {
      const topicId = topic.name.split('/').pop() ?? ''
      return {
        name: topic.name,
        projectId,
        topicId,
      }
    })
  }

  /**
   * Deletes a topic
   * @param projectId - GCP Project ID
   * @param topicId - Topic ID to delete
   */
  public async deleteTopic(projectId: string, topicId: string): Promise<void> {
    const client = this.getClient(projectId)
    await client.topic(topicId).delete()
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
    } = params

    const client = this.getClient(projectId)
    const topic = client.topic(topicId)

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
      retainAckedMessages = false,
      enableMessageOrdering = false,
      filter,
      deadLetterPolicy,
      retryPolicy,
      labels,
    } = params

    const client = this.getClient(projectId)
    const topic = client.topic(topicId)

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
  public async subscriptionExists(projectId: string, subscriptionId: string): Promise<boolean> {
    const client = this.getClient(projectId)

    try {
      const [exists] = await client.subscription(subscriptionId).exists()
      return exists
    } catch {
      return false
    }
  }

  /**
   * Gets subscription information
   * @param projectId - GCP Project ID
   * @param subscriptionId - Subscription ID
   * @returns Subscription information
   */
  public async getSubscription(projectId: string, subscriptionId: string): Promise<ISubscriptionInfo> {
    const client = this.getClient(projectId)
    const subscription = client.subscription(subscriptionId)
    const [metadata] = await subscription.getMetadata()

    let type: 'PULL' | 'PUSH' | 'BIGQUERY' = 'PULL'
    if (metadata.pushConfig?.pushEndpoint) {
      type = 'PUSH'
    } else if (metadata.bigqueryConfig?.table) {
      type = 'BIGQUERY'
    }

    return {
      name: subscription.name,
      projectId,
      subscriptionId,
      topicName: metadata.topic ?? '',
      type,
      ackDeadlineSeconds: metadata.ackDeadlineSeconds ?? 10,
      messageRetentionDuration: metadata.messageRetentionDuration?.seconds
        ? this.secondsToDuration(Number(metadata.messageRetentionDuration.seconds))
        : undefined,
      enableMessageOrdering: metadata.enableMessageOrdering ?? false,
      labels: metadata.labels as Record<string, string> | undefined,
    }
  }

  /**
   * Lists all subscriptions in a project
   * @param projectId - GCP Project ID
   * @returns Array of subscription information
   */
  public async listSubscriptions(projectId: string): Promise<ISubscriptionInfo[]> {
    const client = this.getClient(projectId)
    const [subscriptions] = await client.getSubscriptions()

    return Promise.all(
      subscriptions.map(async (subscription) => {
        const [metadata] = await subscription.getMetadata()
        const subscriptionId = subscription.name.split('/').pop() ?? ''

        let type: 'PULL' | 'PUSH' | 'BIGQUERY' = 'PULL'
        if (metadata.pushConfig?.pushEndpoint) {
          type = 'PUSH'
        } else if (metadata.bigqueryConfig?.table) {
          type = 'BIGQUERY'
        }

        return {
          name: subscription.name,
          projectId,
          subscriptionId,
          topicName: metadata.topic ?? '',
          type,
          ackDeadlineSeconds: metadata.ackDeadlineSeconds ?? 10,
          messageRetentionDuration: metadata.messageRetentionDuration?.seconds
            ? this.secondsToDuration(Number(metadata.messageRetentionDuration.seconds))
            : undefined,
          enableMessageOrdering: metadata.enableMessageOrdering ?? false,
          labels: metadata.labels as Record<string, string> | undefined,
        }
      }),
    )
  }

  /**
   * Lists all subscriptions for a specific topic
   * @param projectId - GCP Project ID
   * @param topicId - Topic ID
   * @returns Array of subscription information
   */
  public async listTopicSubscriptions(
    projectId: string,
    topicId: string,
  ): Promise<ISubscriptionInfo[]> {
    const client = this.getClient(projectId)
    const topic = client.topic(topicId)
    const [subscriptions] = await topic.getSubscriptions()

    return Promise.all(
      subscriptions.map(async (subscription) => {
        const [metadata] = await subscription.getMetadata()
        const subscriptionId = subscription.name.split('/').pop() ?? ''

        let type: 'PULL' | 'PUSH' | 'BIGQUERY' = 'PULL'
        if (metadata.pushConfig?.pushEndpoint) {
          type = 'PUSH'
        } else if (metadata.bigqueryConfig?.table) {
          type = 'BIGQUERY'
        }

        return {
          name: subscription.name,
          projectId,
          subscriptionId,
          topicName: topic.name,
          type,
          ackDeadlineSeconds: metadata.ackDeadlineSeconds ?? 10,
          messageRetentionDuration: metadata.messageRetentionDuration?.seconds
            ? this.secondsToDuration(Number(metadata.messageRetentionDuration.seconds))
            : undefined,
          enableMessageOrdering: metadata.enableMessageOrdering ?? false,
          labels: metadata.labels as Record<string, string> | undefined,
        }
      }),
    )
  }

  /**
   * Deletes a subscription
   * @param projectId - GCP Project ID
   * @param subscriptionId - Subscription ID to delete
   */
  public async deleteSubscription(projectId: string, subscriptionId: string): Promise<void> {
    const client = this.getClient(projectId)
    await client.subscription(subscriptionId).delete()
  }

  /**
   * Updates subscription acknowledge deadline
   * @param projectId - GCP Project ID
   * @param subscriptionId - Subscription ID
   * @param ackDeadlineSeconds - New acknowledge deadline in seconds (10-600)
   */
  public async updateSubscriptionAckDeadline(
    projectId: string,
    subscriptionId: string,
    ackDeadlineSeconds: number,
  ): Promise<void> {
    const client = this.getClient(projectId)
    const subscription = client.subscription(subscriptionId)

    await subscription.setMetadata({
      ackDeadlineSeconds,
    })
  }

  /**
   * Seeks a subscription to a specific timestamp (replay messages)
   * @param projectId - GCP Project ID
   * @param subscriptionId - Subscription ID
   * @param timestamp - Timestamp to seek to
   */
  public async seekSubscription(
    projectId: string,
    subscriptionId: string,
    timestamp: Date,
  ): Promise<void> {
    const client = this.getClient(projectId)
    const subscription = client.subscription(subscriptionId)

    await subscription.seek(timestamp)
  }
}

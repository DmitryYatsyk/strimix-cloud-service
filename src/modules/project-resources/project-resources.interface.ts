export interface IProjectResources {
  project_id: number
  stream_id: string
  gcloud_project_id: string
  bq_dataset_id: string
  bq_dataset_location: 'EU' | 'US'
  pubsub_topic_id: string
  pubsub_event_processor_subscription_id: string
  pubsub_raw_events_subscription_id: string
  pubsub_bigquery_raw_events_subscription_id: string
}

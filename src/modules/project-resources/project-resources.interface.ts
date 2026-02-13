export interface IProjectResources {
  project_id: number
  stream_id: string
  gcloud_project_id: string
  bigquery: {
    dataset_id: string | null
    dataset_location: 'EU' | 'US' | null
    raw_events_table_id: string | null
    ad_costs_table_id: string | null
    excluded_referrers_table_id: string | null
    identified_events_table_id: string | null
  }
  pubsub: {
    event_collector_topic_id: string | null
    event_processor_subscription_id: string | null
    bigquery_raw_events_subscription_id: string | null
  }
}

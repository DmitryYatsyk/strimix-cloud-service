export interface IProjectResources {
  project_id: number
  stream_id: string
  gcloud: {
    project_id: string
    bigquery: {
      dataset_id: string | null
      dataset_location: 'EU' | 'US' | null
      raw_events_table_id: string | null
      ad_costs_table_id: string | null
      excluded_referrers_table_id: string | null
      identified_events_table_id: string | null
      facebook_ads_ad_costs_table_id: string | null
      google_ads_ad_costs_table_id: string | null
      tiktok_ads_ad_costs_table_id: string | null
    }
    pubsub: {
      event_collector_topic_id: string | null
      event_processor_subscription_id: string | null
      bigquery_raw_events_subscription_id: string | null
    }
  }
  identification_service: {
    job_id: string | null
  }
  data_processing_service: {
    project_config_id: string | null
  }
}

export interface IProjectResources {
  project_id: number
  stream_id: string
  gcloud: {
    project_id: string
    bigquery: {
      dataset: {
        id: string | null
        location: 'EU' | 'US' | null
      }
      tables: {
        raw_events: string | null
        identified_events: string | null
        excluded_referrers: string | null
        ad_costs: string | null
        facebook_ads_ad_costs: string | null
        google_ads_ad_costs: string | null
        tiktok_ads_ad_costs: string | null
      }
      scheduled_queries: {
        calculate_events_attribution: string | null
        facebook_ads_ad_costs_update: string | null
        google_ads_ad_costs_update: string | null
        tiktok_ads_ad_costs_update: string | null
      }
    }
    pubsub: {
      topics: {
        event_collector: string | null
      }
      subscriptions: {
        bigquery_raw_events: string | null
        identity_service: string | null
      }
    }
  }
  identification_service: {
    job_id: string | null
  }
  data_processing_service: {
    project_config_id: string | null
  }
}

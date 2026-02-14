import { Document } from 'mongoose'
import { PROJECT_CONFIG } from './project-config.constants.js'

type JobsInfo = {
  check_unattributed_events_share: {
    is_running: boolean
    last_run: number // Unix timestamp in milliseconds
    error_spec: {
      type: (typeof PROJECT_CONFIG.ERROR_TYPES)[keyof typeof PROJECT_CONFIG.ERROR_TYPES]
      message: string
    } | null
  }
  check_ad_costs_without_visits: {
    is_running: boolean
    last_run: number // Unix timestamp in milliseconds
    error_spec: {
      type: (typeof PROJECT_CONFIG.ERROR_TYPES)[keyof typeof PROJECT_CONFIG.ERROR_TYPES]
      message: string
    } | null
  }
  calculate_events_attribution: {
    is_running: boolean
    last_run: number // Unix timestamp in milliseconds
    error_spec: {
      type: (typeof PROJECT_CONFIG.ERROR_TYPES)[keyof typeof PROJECT_CONFIG.ERROR_TYPES]
      message: string
    } | null
  }
  update_facebook_ad_costs: {
    is_running: boolean
    last_run: number // Unix timestamp in milliseconds
    error_spec: {
      type: (typeof PROJECT_CONFIG.ERROR_TYPES)[keyof typeof PROJECT_CONFIG.ERROR_TYPES]
      message: string
    } | null
  }
  update_google_ad_costs: {
    is_running: boolean
    last_run: number // Unix timestamp in milliseconds
    error_spec: {
      type: (typeof PROJECT_CONFIG.ERROR_TYPES)[keyof typeof PROJECT_CONFIG.ERROR_TYPES]
      message: string
    } | null
  }
  update_tiktok_ad_costs: {
    is_running: boolean
    last_run: number // Unix timestamp in milliseconds
    error_spec: {
      type: (typeof PROJECT_CONFIG.ERROR_TYPES)[keyof typeof PROJECT_CONFIG.ERROR_TYPES]
      message: string
    } | null
  }
  update_manual_ad_costs: {
    is_running: boolean
    last_run: number // Unix timestamp in milliseconds
    error_spec: {
      type: (typeof PROJECT_CONFIG.ERROR_TYPES)[keyof typeof PROJECT_CONFIG.ERROR_TYPES]
      message: string
    } | null
  }
}
export interface IProjectConfig {
  id: string
  project_id: number
  unattributed_events_threshold: number
  ignored_event_filters: []
  jobs: JobsInfo
}

export interface IProjectConfigDoc extends Document, Omit<IProjectConfig, 'id'> {}

export const PROFILE_MERGE_EVENTS_TABLE_ID = 'profile_merge_events'

export const PROFILE_MERGE_EVENTS_TABLE_SCHEMA = [
  { name: 'merge_job_id', type: 'STRING', mode: 'REQUIRED' },
  { name: 'parent_profile_id', type: 'STRING', mode: 'REQUIRED' },
  { name: 'merged_profile_id', type: 'STRING', mode: 'REQUIRED' },
  { name: 'merge_timestamp', type: 'INTEGER', mode: 'REQUIRED' },
  { name: 'date', type: 'DATE', mode: 'REQUIRED' },
  { name: 'inserted_at', type: 'INTEGER', mode: 'REQUIRED' },
]

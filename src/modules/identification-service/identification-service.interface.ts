interface IIdentificationJob {
  id: string
  project_id: number
  is_running: boolean
  status: 'PAUSED' | 'ACTIVE' | 'ERROR'
  last_run: number
  error_spec: null
}

export type { IIdentificationJob }

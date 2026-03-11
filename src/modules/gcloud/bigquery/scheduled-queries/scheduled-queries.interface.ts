export interface IScheduledQueryTemplateVariables {
  projectName: string
  datasetName: string
  projectTimezone: string
}

export interface IScheduledQueryConfig {
  displayNamePrefix: string
  templateName: string
  schedule: string
}

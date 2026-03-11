import type { IScheduledQueryTemplateVariables } from './scheduled-queries.interface.js'

const PLACEHOLDERS = {
  projectName: '@GCP_PROJECT_NAME',
  datasetName: '@GPC_BQ_DATASET_NAME',
  projectTimezone: '@PROJECT_TIMEZONE',
} as const

export function processScheduledQueryTemplate(
  template: string,
  variables: IScheduledQueryTemplateVariables,
): string {
  let result = template
  result = result.split(PLACEHOLDERS.projectName).join(variables.projectName)
  result = result.split(PLACEHOLDERS.datasetName).join(variables.datasetName)
  result = result.split(PLACEHOLDERS.projectTimezone).join(variables.projectTimezone)
  return result
}

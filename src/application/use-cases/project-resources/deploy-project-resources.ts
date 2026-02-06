import { IdentificationJobRepository } from '@modules/identification-service'

const deployProjectResources = async (projectId: number) => {
  // TODO: Implement this
  console.log('Deploying project resources for project ID:', projectId)

  // 1. Create BigQuery Dataset

  // 2. Create BigQuery raw events table (for event log)

  // 3. Create BigQuery raw events table (for backup from pubsub)

  // 4. Create BigQuery identified events table

  // 5. Create BigQuery excluded referrers table

  // 6. Create BigQuery ad cost table

  // 7. Deploy GCloud PubSub Topic

  // 8. Deploy GCloud PubSub Raw Events Subscription (for event logs)

  // 9. Deploy GCloud PubSub BigQuery Raw Events Subscription

  // 10. Deploy GCloud PubSub Event Processor Subscription

  // 11. Create identification job in Identification Service
  await IdentificationJobRepository.create({
    project_id: projectId,
    is_running: false,
    status: 'ACTIVE',
    last_run: 0,
    error_spec: null,
  })

  // 12. Create attribution calculation job

  // 13. Create Facebook Ads ad cost calculation job

  // 14. Create Google Ads ad cost calculation job

  // 15. Create TikTok Ads ad cost calculation job

  return
}

export { deployProjectResources }

export const EVENT_COLLECTOR_PUBSUB_MESSAGES_TABLE_SCHEMA = [
  { name: 'subscription_name', type: 'STRING' },
  { name: 'message_id', type: 'STRING' },
  { name: 'publish_time', type: 'TIMESTAMP' },
  { name: 'data', type: 'STRING' },
  { name: 'attributes', type: 'STRING' },
]

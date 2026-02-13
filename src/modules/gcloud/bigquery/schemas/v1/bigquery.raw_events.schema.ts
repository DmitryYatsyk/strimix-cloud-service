import {
  KEY_TYPED_VALUE_FIELDS,
  KEY_STRING_VALUE_FIELDS,
  USER_DATA_FIELD,
  DEAL_FIELD,
  OFFERS_FIELD,
  ORDER_FIELD,
  PRODUCTS_FIELD,
  TRANSACTION_FIELD,
  GEO_FIELD,
  DEVICE_INFO_FIELD,
} from './common-schemas'

export const RAW_EVENTS_TABLE_ID = 'raw_events'

export const RAW_EVENTS_TABLE_SCHEMA = [
  { name: 'date', type: 'DATE' },
  { name: 'timestamp', type: 'INTEGER' },
  { name: 'event_id', type: 'STRING' },
  { name: 'event_name', type: 'STRING' },
  {
    name: 'event_params',
    type: 'RECORD',
    mode: 'REPEATED',
    fields: KEY_TYPED_VALUE_FIELDS,
  },
  USER_DATA_FIELD,
  {
    name: 'user_properties',
    type: 'RECORD',
    mode: 'REPEATED',
    fields: KEY_TYPED_VALUE_FIELDS,
  },
  {
    name: 'user_external_ids',
    type: 'RECORD',
    mode: 'REPEATED',
    fields: KEY_STRING_VALUE_FIELDS,
  },
  { name: 'strimix_avid', type: 'STRING' },
  {
    name: 'ad_data',
    type: 'RECORD',
    mode: 'REPEATED',
    fields: [
      { name: 'ad_network', type: 'STRING' },
      {
        name: 'values',
        type: 'RECORD',
        mode: 'REPEATED',
        fields: KEY_STRING_VALUE_FIELDS,
      },
    ],
  },
  DEAL_FIELD,
  OFFERS_FIELD,
  ORDER_FIELD,
  PRODUCTS_FIELD,
  TRANSACTION_FIELD,
  GEO_FIELD,
  DEVICE_INFO_FIELD,
  { name: 'is_test_event', type: 'BOOLEAN' },
]

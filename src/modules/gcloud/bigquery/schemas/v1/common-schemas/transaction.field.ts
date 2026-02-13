import { CUSTOM_PARAMS_FIELD } from './custom-params.field'

export const TRANSACTION_FIELD = {
  name: 'transaction',
  type: 'RECORD',
  fields: [
    { name: 'id', type: 'STRING' },
    { name: 'status', type: 'STRING' },
    { name: 'value', type: 'FLOAT' },
    { name: 'currency', type: 'STRING' },
    { name: 'tax', type: 'FLOAT' },
    { name: 'payment_method', type: 'STRING' },
    { name: 'deal_id', type: 'STRING' },
    { name: 'order_id', type: 'STRING' },
    CUSTOM_PARAMS_FIELD,
  ],
}

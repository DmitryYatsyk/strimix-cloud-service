import { CUSTOM_PARAMS_FIELD } from './custom-params.field'

export const ORDER_FIELD = {
  name: 'order',
  type: 'RECORD',
  fields: [
    { name: 'id', type: 'STRING' },
    { name: 'status', type: 'STRING' },
    { name: 'manager', type: 'STRING' },
    { name: 'value', type: 'FLOAT' },
    { name: 'paid_value', type: 'FLOAT' },
    { name: 'refund_value', type: 'FLOAT' },
    { name: 'currency', type: 'STRING' },
    { name: 'shipping', type: 'FLOAT' },
    { name: 'tax', type: 'FLOAT' },
    { name: 'promo_action', type: 'STRING' },
    { name: 'discount_amount', type: 'FLOAT' },
    { name: 'discount_percentage', type: 'FLOAT' },
    { name: 'payment_method', type: 'STRING' },
    CUSTOM_PARAMS_FIELD,
  ],
}

export const OFFERS_FIELD = {
  name: 'offers',
  type: 'RECORD',
  mode: 'REPEATED',
  fields: [
    { name: 'id', type: 'STRING' },
    { name: 'name', type: 'STRING' },
    { name: 'value', type: 'FLOAT' },
    { name: 'currency', type: 'STRING' },
    { name: 'promo_action', type: 'STRING' },
    { name: 'discount_amount', type: 'FLOAT' },
    { name: 'discount_percentage', type: 'FLOAT' },
  ],
}

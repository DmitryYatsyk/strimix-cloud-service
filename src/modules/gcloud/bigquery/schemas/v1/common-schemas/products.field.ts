export const PRODUCTS_FIELD = {
  name: 'products',
  type: 'RECORD',
  mode: 'REPEATED',
  fields: [
    { name: 'id', type: 'STRING' },
    { name: 'name', type: 'STRING' },
    { name: 'brand', type: 'STRING' },
    { name: 'category', type: 'STRING' },
    { name: 'sku', type: 'STRING' },
    { name: 'quantity', type: 'INTEGER' },
    { name: 'value', type: 'FLOAT' },
    { name: 'currency', type: 'STRING' },
    { name: 'promo_action', type: 'STRING' },
    { name: 'discount_amount', type: 'FLOAT' },
    { name: 'discount_percentage', type: 'FLOAT' },
  ],
}

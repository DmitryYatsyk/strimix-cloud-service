import { TYPED_VALUE_FIELDS } from './typed-value.fields'

export const KEY_TYPED_VALUE_FIELDS = [
  { name: 'key', type: 'STRING' },
  {
    name: 'value',
    type: 'RECORD',
    fields: TYPED_VALUE_FIELDS,
  },
]

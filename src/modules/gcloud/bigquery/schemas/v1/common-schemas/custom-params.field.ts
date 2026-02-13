import { KEY_TYPED_VALUE_FIELDS } from './key-typed-value.fields'

export const CUSTOM_PARAMS_FIELD = {
  name: 'custom_params',
  type: 'RECORD',
  mode: 'REPEATED',
  fields: KEY_TYPED_VALUE_FIELDS,
}

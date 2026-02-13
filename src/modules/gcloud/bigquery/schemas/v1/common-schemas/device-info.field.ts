export const DEVICE_INFO_FIELD = {
  name: 'device_info',
  type: 'RECORD',
  fields: [
    { name: 'category', type: 'STRING' },
    { name: 'mobile_brand_name', type: 'STRING' },
    { name: 'mobile_model_name', type: 'STRING' },
    { name: 'operating_system', type: 'STRING' },
    { name: 'operating_system_version', type: 'STRING' },
    { name: 'language', type: 'STRING' },
    { name: 'timezone', type: 'STRING' },
    { name: 'timezone_offset_seconds', type: 'INTEGER' },
    { name: 'ip', type: 'STRING' },
    { name: 'screen_resolution', type: 'STRING' },
    {
      name: 'web_info',
      type: 'RECORD',
      fields: [
        { name: 'browser', type: 'STRING' },
        { name: 'browser_version', type: 'STRING' },
        { name: 'user_agent', type: 'STRING' },
      ],
    },
  ],
}

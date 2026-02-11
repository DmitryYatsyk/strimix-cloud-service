import axios from 'axios'

class ErrorNotificator {
  /**
   *
   * @param service_name
   * @param error_name
   * @param project_id
   * @param process_info
   * @param input_data
   * @param error_data
   * @param error_stack
   * @returns
   */
  public static async collect(args: {
    service_name: string
    error_name: string
    project_id?: string | number
    process_info?: any
    input_data?: any
    error_data?: any
    error_stack?: string
  }): Promise<any> {
    const {
      service_name,
      error_name,
      project_id,
      process_info,
      input_data,
      error_data,
      error_stack,
    } = args

    const data = {
      service_name: service_name ?? undefined,
      error_name: error_name ?? undefined,
      project_id: project_id ?? undefined,
      process_info: process_info ?? undefined,
      input_data: input_data ?? undefined,
      error_data: error_data ?? undefined,
      error_stack: error_stack ?? undefined,
    }

    const config = {
      method: 'post',
      url: process.env.ERROR_NOTIFICATOR_URL,
      headers: { 'content-type': 'application/json' },
      data,
    }

    const req = axios(config)
      .then()
      .catch((e) => {
        console.log(e)
        throw new Error('Error notificator request error!')
      })
    return req
  }
}

export { ErrorNotificator }

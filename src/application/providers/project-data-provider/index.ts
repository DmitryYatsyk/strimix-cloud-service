import axios from 'axios'

class ProjectDataProvider {
  static async getProjectInfo(projectId: number): Promise<{
    id: number
    streamId: string
    name: string
    organizationId: number
    organizationName: string
    timezone: string
    currency: string
  }> {
    const apiGatewayURL =
      process.env.API_GATEWAY_HOST + '/api/v1/data-provider-for-cloud-service/get-project-info'

    const config = {
      method: 'post',
      url: apiGatewayURL,
      headers: {
        'content-type': 'application/json',
        authorization: process.env.API_GATEWAY_AUTHORIZATION_CODE,
      },
      data: { project_id: projectId },
    }

    const req = axios(config)
      .then((response) => {
        return response.data
      })
      .catch((e) => {
        console.log(e)
        if (e.response?.data?.message) {
          if ((e.response.status = 404)) {
            return null
          } else throw Error(e.response.data.message)
        } else throw Error('Internal server error')
      })
    return req
  }
}

export { ProjectDataProvider }

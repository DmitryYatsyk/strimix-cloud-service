import { Express, Request, Response } from 'express'
import swaggerJSDoc from 'swagger-jsdoc'
import SwaggerUI from 'swagger-ui-express'
import { version } from '../../../package.json'

const specOptions: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Cloud Service REST API',
      version,
      description: `Public API endpoints specification

Base URL: ${
        process.env.NODE_ENV !== 'development'
          ? `[https://${process.env.PRODUCTION_HOSTNAME}/api/v1](https://${process.env.PRODUCTION_HOSTNAME}/api/v1)`
          : `[http://localhost:${process.env.PORT}/api/v1](http://localhost:${process.env.PORT}/api/v1)`
      }
`,
    },
    components: {
      securitySchemes: {
        apiKeyAuth: {
          type: 'apiKey',
          in: 'header',
          name: 'Authorization',
          description: 'API key authentication using Authorization header',
        },
      },
    },
    servers: [
      {
        url:
          process.env.NODE_ENV !== 'development'
            ? `https://${process.env.PRODUCTION_HOSTNAME}/api/v1`
            : `http://localhost:${process.env.PORT}/api/v1`,
      },
    ],
  },
  apis: [
    './src/presentation/docs/**/*.yaml',
    './src/presentation/docs/**/**/*.yaml',
    './src/presentation/docs/**/**/**/*.yaml',
    './src/presentation/docs/**/**/**/**/*.yaml',
  ],
}

// Swagger html options
const htmlOptions = {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Cloud Service REST API',
}

const swaggerSpec = swaggerJSDoc(specOptions)

function swaggerDocs(app: Express, port: number) {
  // Swagger page
  app.use('/api/v1/docs', SwaggerUI.serve, SwaggerUI.setup(swaggerSpec, htmlOptions))

  // Docs in JSON format
  app.get('/api/v1/docs.json', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json')
    res.send(swaggerSpec)
  })

  console.log(
    `Documents are available at '${
      process.env.NODE_ENV !== 'development'
        ? `https://${process.env.PRODUCTION_HOSTNAME}/api/v1/docs`
        : `http://localhost:${process.env.PORT}/api/v1/docs`
    }'`,
  )
}

export { swaggerDocs, swaggerSpec }

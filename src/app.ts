import express, { Application, Express } from 'express'
import mongoose from 'mongoose'
import compression from 'compression'
import morgan from 'morgan'
import helmet from 'helmet'
import { errorMiddleware } from '@presentation/middleware/error.middleware.js'
import { IRouter } from '@presentation/interfaces/router.interface.js'
import { swaggerDocs } from '@presentation/utils/swagger'
import cors from 'cors'

class App {
  public express: Application
  public port: number

  constructor(routers: Array<IRouter>, port: number) {
    this.express = express()
    this.port = port

    this.initialiseMiddleware()
    this.initialiseDatabaseConnection()
    this.initialiseRoutes(routers)
    swaggerDocs(this.express as Express, this.port)
    this.initialiseErrorHandling()
  }

  private initialiseMiddleware(): void {
    this.express.use(helmet())
    this.express.use(morgan('dev'))
    this.express.use(express.json())
    this.express.use(compression())
    this.express.use(cors())
    this.express.disable('x-powered-by')
  }

  private initialiseRoutes(routers: Array<IRouter>): void {
    routers.forEach((el: IRouter) => {
      this.express.use('/api/v1', el.router)
    })
  }

  private initialiseDatabaseConnection(): void {
    // Connect to MongoDB using credentials from env.
    // strictQuery=false keeps compatibility with flexible query parsing in Mongoose v6.
    const { MONGO_CREDENTIALS } = process.env
    mongoose.set('strictQuery', false)
    mongoose.connect(`${MONGO_CREDENTIALS}`)

    // Gracefully close Mongo connection on process termination to avoid dangling sockets.
    process.on('SIGINT', async function () {
      await mongoose.connection.close().then(() => {
        console.log('Mongoose connection disconnected due to application termination')
        process.exit(0)
      })
    })
  }

  private initialiseErrorHandling(): void {
    this.express.use(errorMiddleware)

    // Global error handlers to prevent app crashes
    process.on('uncaughtException', (error: Error) => {
      console.error('Uncaught Exception:', error)
      // Log the error but don't exit the process
    })

    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      console.error('Unhandled Rejection at:', promise, 'reason:', reason)
      // Log the error but don't exit the process
    })
  }

  public listen(): void {
    this.express.listen(this.port, () => {
      console.log(`App listening on port ${this.port}`)
    })
  }
}

export { App }

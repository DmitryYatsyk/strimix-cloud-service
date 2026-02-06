import { cleanEnv, str, port } from 'envalid'

function validateEnv(): void {
  cleanEnv(process.env, {
    NODE_ENV: str({
      choices: ['development', 'production'],
    }),
    PORT: port({ default: 5017 }),
    APP_AUTHORIZATION_CODES: str(),
    MONGO_CREDENTIALS: str(),
    IDENTITY_SERVICE_MONGO_CREDENTIALS: str(),
    GOOGLE_CLOUD_SERVICE_ACCOUNT: str(),
  })
}

export { validateEnv }

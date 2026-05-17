import 'reflect-metadata'
import 'dotenv/config'
import { NestFactory } from '@nestjs/core'
import { ValidationPipe, Logger } from '@nestjs/common'
import { AppModule } from './app.module'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: false,
  })

  const port = Number(process.env.PORT ?? 3000)
  const host = process.env.HOST ?? '0.0.0.0'
  const corsOrigin = process.env.CORS_ORIGIN
  const trustProxy = process.env.TRUST_PROXY ?? '1'

  app.getHttpAdapter().getInstance().set('trust proxy', trustProxy)

  if (corsOrigin) {
    app.enableCors({
      origin: corsOrigin.split(',').map((origin) => origin.trim()),
      credentials: true,
    })
  }

  app.setGlobalPrefix('api', { exclude: ['health'] })

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  )

  app.enableShutdownHooks()

  await app.listen(port, host)
  Logger.log(`Banex Reintegra API escuchando en http://${host}:${port}`, 'Bootstrap')
}

void bootstrap()

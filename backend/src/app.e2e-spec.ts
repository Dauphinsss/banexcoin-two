import 'reflect-metadata'
import { execSync } from 'node:child_process'
import { existsSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { AppModule } from './app.module'
import { PrismaService } from './prisma/prisma.service'

const TEST_DB_FILE = join(__dirname, '..', 'prisma', 'test-e2e.db')
const TEST_DB_URL = 'file:./test-e2e.db'

describe('App e2e', () => {
  let app: INestApplication
  let prisma: PrismaService

  beforeAll(async () => {
    process.env.NODE_ENV = 'test'
    process.env.DATABASE_URL = TEST_DB_URL
    process.env.UPLOAD_STORAGE_DIR = './data/test-uploads'
    process.env.MAX_UPLOAD_SIZE_MB = '50'

    if (existsSync(TEST_DB_FILE)) unlinkSync(TEST_DB_FILE)

    execSync('bunx prisma db push --schema prisma/schema.prisma --skip-generate', {
      cwd: join(__dirname, '..'),
      env: process.env,
      stdio: 'pipe',
    })

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile()

    app = moduleRef.createNestApplication()
    app.setGlobalPrefix('api', { exclude: ['health'] })
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: false },
      }),
    )

    await app.init()
    prisma = app.get(PrismaService)

    await prisma.cashbackTier.createMany({
      data: [
        {
          level: 1,
          name: 'Basico',
          minAmountBOB: '0',
          maxAmountBOB: '500',
          rebatePercent: '1.00',
          validFromPeriod: '2025-01',
          active: true,
        },
        {
          level: 2,
          name: 'Bronce',
          minAmountBOB: '500.01',
          maxAmountBOB: '1000',
          rebatePercent: '1.50',
          validFromPeriod: '2025-01',
          active: true,
        },
      ],
    })
  })

  afterAll(async () => {
    await app?.close()
    if (existsSync(TEST_DB_FILE)) unlinkSync(TEST_DB_FILE)
  })

  it('responde health con base de datos disponible', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200)

    expect(response.body).toMatchObject({
      status: 'ok',
      service: 'banex-reintegra-api',
      checks: {
        database: { status: 'ok' },
      },
    })
  })

  it('lista tiers activos desde la base de datos', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/tiers?period=2025-04')
      .expect(200)

    expect(response.body).toEqual([
      expect.objectContaining({
        level: 1,
        name: 'Basico',
        minAmountBOB: '0',
        maxAmountBOB: '500',
        rebatePercent: '1',
      }),
      expect.objectContaining({
        level: 2,
        name: 'Bronce',
        minAmountBOB: '500.01',
        maxAmountBOB: '1000',
        rebatePercent: '1.5',
      }),
    ])
  })

  it('rechaza upload sin archivo con error controlado', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/uploads')
      .field('period', '2025-04')
      .expect(400)

    expect(response.body).toMatchObject({
      error: 'INVALID_FILE',
      message: 'No se recibió ningún archivo.',
    })
  })
})

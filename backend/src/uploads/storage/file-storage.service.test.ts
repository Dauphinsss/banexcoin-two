import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { ConfigService } from '@nestjs/config'
import { afterEach, describe, expect, it } from 'vitest'
import { FileStorageService } from './file-storage.service'

const tempDirs: string[] = []

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('FileStorageService', () => {
  it('guarda archivos localmente por defecto', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'banex-storage-'))
    tempDirs.push(dir)
    const service = new FileStorageService(
      new ConfigService({
        FILE_STORAGE_DRIVER: 'local',
        UPLOAD_STORAGE_DIR: dir,
      }),
    )

    const hash = await service.hash(Buffer.from('excel-content'))
    const path = await service.save(hash, 'reporte.xlsx', Buffer.from('excel-content'))

    expect(path).toBe(join(dir, `${hash}.xlsx`))
    expect(await service.exists(hash, 'reporte.xlsx')).toBe(true)
    expect(await readFile(path, 'utf8')).toBe('excel-content')
  })

  it('exige bucket cuando se activa S3', () => {
    expect(() => new FileStorageService(new ConfigService({ FILE_STORAGE_DRIVER: 's3' }))).toThrow(
      'S3_BUCKET es obligatorio cuando FILE_STORAGE_DRIVER=s3.',
    )
  })
})

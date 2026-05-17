import { useCallback, useState, type JSX } from 'react'
import { useDropzone, type FileRejection } from 'react-dropzone'
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  FileUp,
  Loader2,
  X,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { detectPeriod } from '@banex/utils'
import { api, ApiCallError } from '../../lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

const ACCEPTED_TYPES = {
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'application/vnd.ms-excel': ['.xls'],
}

const MAX_BYTES = 50 * 1024 * 1024
const PAGO_QR_SHEET = 'Pago QR'
const PREVIEW_ROWS = 20

const REQUIRED_HEADERS = [
  'Creado por',
  'Número de Cuenta',
  'Monto intercambio',
  'Monto Pagado',
  'Precio',
  'Transacción Id',
] as const

type Stage =
  | { kind: 'idle' }
  | { kind: 'analyzing'; file: File }
  | { kind: 'preview'; file: File; preview: Preview }
  | { kind: 'uploading'; file: File; preview: Preview }
  | { kind: 'success'; uploadId: string }
  | {
      kind: 'duplicate'
      file: File
      preview: Preview
      existingUploadId: string
      canReload: boolean
    }
  | { kind: 'error'; message: string; previousFile?: File }

interface Preview {
  uniqueUsers: number
  totalRows: number
  previewRows: Record<string, unknown>[]
  headers: string[]
  detectedPeriod: string | null
  periodWarning: string | null
  missingHeaders: readonly string[]
}

export default function UploadDropzone(): JSX.Element {
  const [stage, setStage] = useState<Stage>({ kind: 'idle' })

  const analyze = useCallback(async (file: File) => {
    setStage({ kind: 'analyzing', file })
    try {
      const preview = await analyzeFile(file)
      setStage({ kind: 'preview', file, preview })
    } catch (error) {
      setStage({
        kind: 'error',
        message: error instanceof Error ? error.message : 'No se pudo leer el archivo.',
      })
    }
  }, [])

  const onDrop = useCallback(
    (accepted: File[], rejections: FileRejection[]) => {
      if (rejections.length > 0) {
        setStage({
          kind: 'error',
          message: describeRejection(rejections[0]!),
        })
        return
      }
      const file = accepted[0]
      if (file) void analyze(file)
    },
    [analyze],
  )

  if (typeof window === 'undefined') {
    return <UploadDropzoneSkeleton />
  }
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: MAX_BYTES,
    multiple: false,
    disabled: stage.kind === 'analyzing' || stage.kind === 'uploading',
  })

  const submit = useCallback(
    async (allowDuplicate = false) => {
      if (stage.kind !== 'preview' && stage.kind !== 'duplicate') return

      const file = stage.file
      const preview = stage.preview
      setStage({ kind: 'uploading', file, preview })

      try {
        const response = await api.createUpload(
          file,
          preview.detectedPeriod ?? undefined,
          allowDuplicate,
        )
        setStage({ kind: 'success', uploadId: response.uploadId })
      } catch (error) {
        if (error instanceof ApiCallError && error.payload.error === 'DUPLICATE_UPLOAD') {
          setStage({
            kind: 'duplicate',
            file,
            preview,
            existingUploadId: String(error.payload.existingUploadId ?? ''),
            canReload: error.payload.canReload === true,
          })
          return
        }
        const message = error instanceof Error ? error.message : 'Falló la carga.'
        setStage({ kind: 'error', message, previousFile: file })
      }
    },
    [stage],
  )

  const reset = useCallback(() => setStage({ kind: 'idle' }), [])

  return (
    <div className="w-full">
      {stage.kind === 'idle' || stage.kind === 'error' ? (
        <DropzoneEmpty
          rootProps={getRootProps()}
          inputProps={getInputProps()}
          isDragActive={isDragActive}
          errorMessage={stage.kind === 'error' ? stage.message : null}
        />
      ) : null}

      {stage.kind === 'analyzing' ? <AnalyzingState filename={stage.file.name} /> : null}

      {stage.kind === 'preview' ? (
        <PreviewState
          file={stage.file}
          preview={stage.preview}
          onCancel={reset}
          onConfirm={() => void submit(false)}
        />
      ) : null}

      {stage.kind === 'uploading' ? (
        <UploadingState filename={stage.file.name} preview={stage.preview} />
      ) : null}

      {stage.kind === 'success' ? (
        <SuccessState uploadId={stage.uploadId} onUploadAnother={reset} />
      ) : null}

      {stage.kind === 'duplicate' ? (
        <DuplicateState
          existingUploadId={stage.existingUploadId}
          canReload={stage.canReload}
          onReload={() => void submit(true)}
          onTryAnother={reset}
        />
      ) : null}
    </div>
  )
}

const DropzoneEmpty = ({
  rootProps,
  inputProps,
  isDragActive,
  errorMessage,
}: {
  rootProps: ReturnType<ReturnType<typeof useDropzone>['getRootProps']>
  inputProps: ReturnType<ReturnType<typeof useDropzone>['getInputProps']>
  isDragActive: boolean
  errorMessage: string | null
}): JSX.Element => (
  <div className="space-y-3">
    <div
      {...rootProps}
      className={cn(
        'group relative flex cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed px-8 py-16 text-center transition-all duration-200',
        isDragActive
          ? 'scale-[1.01] border-primary bg-primary/5 shadow-lg shadow-primary/10'
          : 'border-border bg-card/40 hover:border-primary/50 hover:bg-card/60',
      )}
    >
      <input {...inputProps} />
      <div
        className={cn(
          'grid size-16 place-items-center rounded-full transition-all',
          isDragActive
            ? 'bg-primary/20 text-primary ring-4 ring-primary/15'
            : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary',
        )}
      >
        <FileUp className="size-7" aria-hidden="true" />
      </div>
      <div className="space-y-1.5">
        <p className="text-base font-semibold text-foreground">
          {isDragActive ? 'Suelta el archivo aquí' : 'Arrastra el reporte mensual de pagos QR'}
        </p>
        <p className="text-sm text-muted-foreground">
          Excel (.xlsx / .xls), máximo 50 MB. Procesamiento aislado del core Banexcoin.
        </p>
      </div>
      <Button type="button" className="mt-2">
        <FileSpreadsheet />
        Seleccionar archivo
      </Button>
    </div>

    {errorMessage ? (
      <Alert variant="destructive">
        <AlertTriangle />
        <AlertTitle>No se pudo procesar el archivo</AlertTitle>
        <AlertDescription>{errorMessage}</AlertDescription>
      </Alert>
    ) : null}
  </div>
)

const UploadDropzoneSkeleton = (): JSX.Element => (
  <div className="w-full max-w-3xl mx-auto" aria-hidden="true">
    <div className="space-y-3">
      <div className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-line-strong bg-panel px-8 py-16 text-center">
        <div className="size-10 rounded-md skeleton-block" />
        <div className="space-y-2">
          <div className="mx-auto h-4 w-72 max-w-full rounded skeleton-block" />
          <div className="mx-auto h-3 w-56 max-w-full rounded skeleton-block" />
        </div>
        <div className="h-10 w-36 rounded-md skeleton-block" />
      </div>
    </div>
  </div>
)

const AnalyzingState = ({ filename }: { filename: string }): JSX.Element => (
  <Card>
    <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
      <Loader2 className="size-8 animate-spin text-primary" />
      <div className="space-y-1">
        <p className="text-base font-medium">Analizando archivo</p>
        <p className="font-mono text-xs text-muted-foreground">{filename}</p>
      </div>
    </CardContent>
  </Card>
)

const PreviewState = ({
  file,
  preview,
  onCancel,
  onConfirm,
}: {
  file: File
  preview: Preview
  onCancel: () => void
  onConfirm: () => void
}): JSX.Element => {
  const blocked = preview.missingHeaders.length > 0 || preview.totalRows === 0
  return (
    <Card>
      <CardContent className="space-y-5 pt-6">
        <header className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="grid size-10 place-items-center rounded-md bg-primary/15 text-primary ring-1 ring-primary/25">
              <FileSpreadsheet className="size-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{file.name}</p>
              <p className="font-mono text-xs text-muted-foreground">
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onCancel}
            aria-label="Cancelar"
          >
            <X />
          </Button>
        </header>

        {preview.missingHeaders.length > 0 ? (
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertTitle>Faltan columnas obligatorias en la hoja "Pago QR"</AlertTitle>
            <AlertDescription>
              <ul className="mt-2 list-disc space-y-0.5 pl-5 font-mono text-xs">
                {preview.missingHeaders.map((h) => (
                  <li key={h}>{h}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Transacciones" value={preview.totalRows.toLocaleString('es-BO')} />
          <Stat label="Usuarios únicos" value={preview.uniqueUsers.toLocaleString('es-BO')} />
          <Stat
            label="Período"
            value={preview.detectedPeriod ?? 'No detectado'}
            mono={!!preview.detectedPeriod}
          />
        </div>

        {preview.periodWarning ? (
          <Alert>
            <AlertTriangle />
            <AlertDescription>{preview.periodWarning}</AlertDescription>
          </Alert>
        ) : null}

        <details className="group rounded-md border border-border bg-muted/30">
          <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm text-muted-foreground transition-colors hover:text-foreground">
            <span>Vista previa de las primeras {preview.previewRows.length} filas</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition-transform group-open:rotate-180">
              <path d="m6 9 6 6 6-6"/>
            </svg>
          </summary>
          <div className="overflow-x-auto border-t border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  {preview.headers.slice(0, 8).map((h) => (
                    <TableHead key={h} className="whitespace-nowrap font-mono text-[11px] uppercase tracking-wider">
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.previewRows.map((row, i) => (
                  <TableRow key={i}>
                    {preview.headers.slice(0, 8).map((h) => (
                      <TableCell key={h} className="font-mono text-xs">
                        {formatCellValue(row[h])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </details>

        <footer className="flex flex-wrap items-center justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="button" onClick={onConfirm} disabled={blocked}>
            Procesar {preview.totalRows.toLocaleString('es-BO')} transacciones
          </Button>
        </footer>
      </CardContent>
    </Card>
  )
}

const UploadingState = ({
  filename,
  preview,
}: {
  filename: string
  preview: Preview
}): JSX.Element => (
  <Card>
    <CardContent className="space-y-4 py-10 text-center">
      <Loader2 className="mx-auto size-8 animate-spin text-primary" />
      <div className="space-y-1">
        <p className="text-base font-medium">Subiendo {filename}…</p>
        <p className="text-sm text-muted-foreground">
          {preview.totalRows.toLocaleString('es-BO')} transacciones en camino.
        </p>
      </div>
      <Progress value={undefined} className="mx-auto max-w-sm" />
    </CardContent>
  </Card>
)

const SuccessState = ({
  uploadId,
  onUploadAnother,
}: {
  uploadId: string
  onUploadAnother: () => void
}): JSX.Element => (
  <Card className="border-emerald-500/30 bg-emerald-500/5">
    <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
      <div className="grid size-14 place-items-center rounded-full bg-emerald-500/15 text-emerald-400 ring-1 ring-emerald-500/30">
        <CheckCircle2 className="size-7" />
      </div>
      <div className="space-y-1.5">
        <p className="text-base font-semibold">Archivo procesado correctamente</p>
        <p className="font-mono text-xs text-muted-foreground">ID: {uploadId}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild>
          <a href={`/uploads/${uploadId}`}>Ver resultados</a>
        </Button>
        <Button type="button" variant="outline" onClick={onUploadAnother}>
          Subir otro
        </Button>
      </div>
    </CardContent>
  </Card>
)

const DuplicateState = ({
  existingUploadId,
  canReload,
  onReload,
  onTryAnother,
}: {
  existingUploadId: string
  canReload: boolean
  onReload: () => void
  onTryAnother: () => void
}): JSX.Element => (
  <Card className="border-amber-500/30 bg-amber-500/5">
    <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
      <div className="grid size-14 place-items-center rounded-full bg-amber-500/15 text-amber-400 ring-1 ring-amber-500/30">
        <AlertTriangle className="size-7" />
      </div>
      <div className="space-y-1.5">
        <p className="text-base font-semibold">Estás subiendo el mismo archivo</p>
        {canReload ? (
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            Estás en modo test. ¿Quieres aplicarlo de todas formas y reemplazar los resultados existentes?
          </p>
        ) : (
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            La recarga está restringida para este entorno.
          </p>
        )}
        <Badge variant="secondary" className="mt-1 font-mono">
          ID existente: {existingUploadId}
        </Badge>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {canReload ? (
          <Button type="button" onClick={onReload}>
            Sí, aplicar de todas formas
          </Button>
        ) : null}
        <Button asChild variant={canReload ? 'outline' : 'default'}>
          <a href={`/uploads/${existingUploadId}`}>Ver resultados existentes</a>
        </Button>
        <Button type="button" variant="ghost" onClick={onTryAnother}>
          Subir otro archivo
        </Button>
      </div>
    </CardContent>
  </Card>
)

const Stat = ({
  label,
  value,
  mono = true,
}: {
  label: string
  value: string
  mono?: boolean
}): JSX.Element => (
  <div className="rounded-md border border-border bg-muted/30 px-4 py-3">
    <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
    <p className={cn('mt-1 text-base font-semibold tabular-nums text-foreground', mono && 'font-mono')}>
      {value}
    </p>
  </div>
)

const analyzeFile = async (file: File): Promise<Preview> => {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true })

  const sheetName = workbook.SheetNames.find(
    (n) => n === PAGO_QR_SHEET || n.trim() === PAGO_QR_SHEET,
  )
  if (!sheetName) {
    throw new Error(`No se encontró la hoja "${PAGO_QR_SHEET}" en el archivo.`)
  }

  const sheet = workbook.Sheets[sheetName]
  if (!sheet) throw new Error(`Hoja "${sheetName}" vacía.`)

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    raw: true,
    defval: null,
  })

  const headers = extractHeaders(sheet)
  const missingHeaders = REQUIRED_HEADERS.filter((h) => !headers.includes(h))

  const users = new Set<string>()
  const dates: Array<Date | string | null> = []
  for (const row of rows) {
    const user = row['Creado por']
    if (typeof user === 'string') users.add(user)
    const date = row['Fecha de creación']
    if (date instanceof Date) dates.push(date)
    else if (typeof date === 'string') dates.push(date)
  }

  const detection = detectPeriod(dates)

  return {
    totalRows: rows.length,
    uniqueUsers: users.size,
    previewRows: rows.slice(0, PREVIEW_ROWS),
    headers,
    detectedPeriod: detection.period,
    periodWarning: detection.warning?.message ?? null,
    missingHeaders,
  }
}

const extractHeaders = (sheet: XLSX.WorkSheet): string[] => {
  const range = XLSX.utils.decode_range(sheet['!ref'] ?? 'A1')
  const headers: string[] = []
  for (let col = range.s.c; col <= range.e.c; col++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: range.s.r, c: col })]
    if (cell && typeof cell.v === 'string') {
      headers.push(cell.v.trim())
    }
  }
  return headers
}

const describeRejection = (rejection: FileRejection): string => {
  const code = rejection.errors[0]?.code
  if (code === 'file-too-large') return 'El archivo supera el límite de 50 MB.'
  if (code === 'file-invalid-type') return 'Solo se aceptan archivos .xlsx o .xls.'
  return rejection.errors[0]?.message ?? 'Archivo rechazado.'
}

const formatCellValue = (value: unknown): string => {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === 'number') return value.toString()
  return String(value).slice(0, 40)
}

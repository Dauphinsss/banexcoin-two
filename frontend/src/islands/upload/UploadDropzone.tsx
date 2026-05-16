import { useCallback, useState, type JSX } from 'react'
import { useDropzone, type FileRejection } from 'react-dropzone'
import * as XLSX from 'xlsx'
import { detectPeriod } from '@banex/utils'
import { api, ApiCallError } from '../../lib/api'

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
  | { kind: 'duplicate'; existingUploadId: string }
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

  // Guard against server-side rendering: only render dropzone on client side
  if (typeof window === 'undefined') {
    // Server-side fallback UI
    return <div className="w-full max-w-3xl mx-auto">Cargando...</div>;
  }
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxSize: MAX_BYTES,
    multiple: false,
    disabled: stage.kind === 'analyzing' || stage.kind === 'uploading',
  })

  const submit = useCallback(async () => {
    if (stage.kind !== 'preview') return
    setStage({ kind: 'uploading', file: stage.file, preview: stage.preview })

    try {
      const response = await api.createUpload(
        stage.file,
        stage.preview.detectedPeriod ?? undefined,
      )
      setStage({ kind: 'success', uploadId: response.uploadId })
    } catch (error) {
      if (error instanceof ApiCallError && error.payload.error === 'DUPLICATE_UPLOAD') {
        setStage({
          kind: 'duplicate',
          existingUploadId: String(error.payload.existingUploadId ?? ''),
        })
        return
      }
      const message = error instanceof Error ? error.message : 'Falló la carga.'
      setStage({ kind: 'error', message, previousFile: stage.file })
    }
  }, [stage])

  const reset = useCallback(() => setStage({ kind: 'idle' }), [])

  return (
    <div className="w-full max-w-3xl mx-auto">
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
          onConfirm={submit}
        />
      ) : null}

      {stage.kind === 'uploading' ? (
        <UploadingState filename={stage.file.name} preview={stage.preview} />
      ) : null}

      {stage.kind === 'success' ? (
        <SuccessState uploadId={stage.uploadId} onUploadAnother={reset} />
      ) : null}

      {stage.kind === 'duplicate' ? (
        <DuplicateState existingUploadId={stage.existingUploadId} onTryAnother={reset} />
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
      className={`
        flex flex-col items-center justify-center gap-3
        rounded-xl border-2 border-dashed
        px-8 py-16 text-center cursor-pointer
        transition-all duration-150
        ${isDragActive
          ? 'border-brand bg-brand-soft scale-[1.01]'
          : 'border-line-strong hover-border-line-hover bg-panel'}
      `}
    >
      <input {...inputProps} />
      <div className="text-4xl text-faint">↑</div>
      <div className="space-y-1">
        <p className="text-soft font-medium">
          Arrastra el reporte mensual de pagos QR
        </p>
        <p className="text-sm text-muted">
          Excel (.xlsx), máximo 50 MB. Procesamiento independiente del core Banexcoin.
        </p>
      </div>
      <button
        type="button"
        className="mt-4 px-4 py-2 rounded-md bg-brand hover-bg-brand-hover text-inverse text-sm font-medium"
      >
        Seleccionar archivo
      </button>
    </div>

    {errorMessage ? (
      <div className="rounded-md border border-danger-soft bg-danger-soft px-4 py-3 text-sm text-danger">
        {errorMessage}
      </div>
    ) : null}
  </div>
)

const AnalyzingState = ({ filename }: { filename: string }): JSX.Element => (
  <div className="rounded-xl border border-line-strong bg-panel p-8 text-center">
    <p className="text-muted text-sm">Analizando {filename}...</p>
  </div>
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
    <div className="space-y-4 rounded-xl border border-line-strong bg-panel p-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-main font-medium">{file.name}</p>
          <p className="text-xs text-muted font-mono">
            {(file.size / 1024 / 1024).toFixed(2)} MB
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-muted hover-text-soft text-lg"
          aria-label="Cancelar"
        >
          ×
        </button>
      </header>

      {preview.missingHeaders.length > 0 ? (
        <div className="rounded-md border border-danger-soft bg-danger-soft px-4 py-3 text-sm text-danger">
          <p className="font-medium">Faltan columnas obligatorias en la hoja "Pago QR":</p>
          <ul className="mt-1 list-disc list-inside font-mono text-xs">
            {preview.missingHeaders.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <dl className="grid grid-cols-3 gap-4 text-sm">
        <Stat label="Transacciones" value={preview.totalRows.toLocaleString('es-BO')} />
        <Stat label="Usuarios únicos" value={preview.uniqueUsers.toLocaleString('es-BO')} />
        <Stat
          label="Período"
          value={preview.detectedPeriod ?? 'No detectado'}
        />
      </dl>

      {preview.periodWarning ? (
        <div className="rounded-md border border-warning-soft bg-warning-soft px-4 py-3 text-sm text-warning">
          {preview.periodWarning}
        </div>
      ) : null}

      <details className="rounded-md border border-line-strong bg-panel-inset-strong p-3">
        <summary className="cursor-pointer text-sm text-muted">
          Vista previa de las primeras {preview.previewRows.length} filas
        </summary>
        <div className="mt-3 overflow-x-auto">
          <table className="text-xs font-mono">
            <thead>
              <tr className="text-muted">
                {preview.headers.slice(0, 8).map((h) => (
                  <th key={h} className="px-2 py-1 text-left border-b border-line">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.previewRows.map((row, i) => (
                <tr key={i} className="text-muted">
                  {preview.headers.slice(0, 8).map((h) => (
                    <td key={h} className="px-2 py-1 border-b border-app">
                      {formatCellValue(row[h])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <footer className="flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-md text-sm text-muted hover-text-inverse"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={blocked}
          className="px-5 py-2 rounded-md text-sm font-medium bg-brand hover-bg-brand-hover text-inverse disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Procesar {preview.totalRows.toLocaleString('es-BO')} transacciones
        </button>
      </footer>
    </div>
  )
}

const UploadingState = ({
  filename,
  preview,
}: {
  filename: string
  preview: Preview
}): JSX.Element => (
  <div className="rounded-xl border border-line-strong bg-panel p-8 text-center space-y-2">
    <p className="text-main font-medium">Subiendo {filename}…</p>
    <p className="text-sm text-muted">
      {preview.totalRows.toLocaleString('es-BO')} transacciones en camino.
    </p>
  </div>
)

const SuccessState = ({
  uploadId,
  onUploadAnother,
}: {
  uploadId: string
  onUploadAnother: () => void
}): JSX.Element => (
  <div className="rounded-xl border border-success-soft bg-success-faint p-8 text-center space-y-4">
    <p className="text-success-strong text-2xl">✓</p>
    <div>
      <p className="text-main font-medium">Archivo procesado correctamente.</p>
      <p className="text-xs text-muted font-mono mt-1">ID: {uploadId}</p>
    </div>
    <button
      type="button"
      onClick={onUploadAnother}
      className="px-4 py-2 rounded-md text-sm font-medium bg-brand hover-bg-brand-hover text-inverse"
    >
      Subir otro
    </button>
  </div>
)

const DuplicateState = ({
  existingUploadId,
  onTryAnother,
}: {
  existingUploadId: string
  onTryAnother: () => void
}): JSX.Element => (
  <div className="rounded-xl border border-warning-soft bg-warning-faint p-8 text-center space-y-4">
    <p className="text-warning-strong text-2xl">⚠</p>
    <div>
      <p className="text-main font-medium">Este archivo ya fue procesado anteriormente.</p>
      <p className="text-xs text-muted font-mono mt-1">ID existente: {existingUploadId}</p>
    </div>
    <div className="flex justify-center gap-3">
      <a
        href={`/uploads/${existingUploadId}`}
        className="px-4 py-2 rounded-md text-sm font-medium bg-brand hover-bg-brand-hover text-inverse"
      >
        Ver resultados existentes
      </a>
      <button
        type="button"
        onClick={onTryAnother}
        className="px-4 py-2 rounded-md text-sm text-muted hover-text-inverse"
      >
        Subir otro archivo
      </button>
    </div>
  </div>
)

const Stat = ({ label, value }: { label: string; value: string }): JSX.Element => (
  <div className="rounded-md border border-line-strong bg-panel-inset px-4 py-3">
    <dt className="text-xs uppercase tracking-wide text-faint">{label}</dt>
    <dd className="mt-1 font-mono tabular-nums text-main">{value}</dd>
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

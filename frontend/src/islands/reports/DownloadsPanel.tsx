import { useEffect, useState, type JSX } from 'react'
import { ArrowRight, BarChart3, Scale, Send, type LucideIcon } from 'lucide-react'
import type { UploadSummary } from '@banex/types'
import { api } from '../../lib/api'

interface DownloadsPanelProps {
  uploadId?: string
}

/**
 * F6.4 · Panel de descargas. Tres botones:
 *   - Reporte Excel (4 hojas)
 *   - BanexTransfer (formato hoja Transfers)
 *   - Cuadre DEBE/HABER (replica hoja Saldos)
 *
 * Si no recibe `uploadId` por props, busca el último upload procesado (DONE).
 */
export const DownloadsPanel = ({ uploadId }: DownloadsPanelProps): JSX.Element | null => {
  const [upload, setUpload] = useState<UploadSummary | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false
    const load = async (): Promise<void> => {
      try {
        if (uploadId) {
          const u = await api.getUpload(uploadId)
          if (!cancelled) {
            setUpload(u)
            setStatus(u.status === 'DONE' ? 'ready' : 'empty')
          }
          return
        }
        const uploads = await api.listUploads()
        const latest = uploads.find((u) => u.status === 'DONE') ?? null
        if (!cancelled) {
          setUpload(latest)
          setStatus(latest ? 'ready' : 'empty')
        }
      } catch {
        if (!cancelled) setStatus('error')
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [uploadId])

  if (status === 'loading') {
    return <p className="text-sm text-muted">Cargando descargas...</p>
  }

  if (status === 'error' || !upload) {
    return null
  }

  if (status === 'empty') {
    return (
      <p className="text-sm text-muted">
        Las descargas estarán disponibles cuando un upload termine de procesarse.
      </p>
    )
  }

  return (
    <div className="rounded-lg border border-line bg-panel p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm uppercase tracking-widest text-faint">Descargas</h3>
          <p className="mt-1 text-xs text-muted">
            Período <span className="font-mono text-muted">{upload.period ?? '—'}</span> ·
            {' '}archivo <span className="font-mono text-muted">{upload.filename}</span>
          </p>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <DownloadCard
          href={api.reportUrl(upload.id)}
          title="Reporte Excel"
          description="4 hojas: reintegros, resumen por nivel, anomalías y errores de parseo."
          accent="blue"
          icon={BarChart3}
        />
        <DownloadCard
          href={api.banexTransferUrl(upload.id)}
          title="BanexTransfer"
          description="Archivo listo para cargar transferencias masivas en el formato interno de Banexcoin."
          accent="green"
          icon={Send}
        />
        <DownloadCard
          href={api.balanceSheetUrl(upload.id)}
          title="Cuadre DEBE/HABER"
          description="Réplica de la hoja Saldos del Excel original: balance por usuario y por servicio."
          accent="purple"
          icon={Scale}
        />
      </div>

      <p className="text-xs text-faint">
        Las descargas se regeneran al momento desde la base de datos. El archivo BanexTransfer
        usa la cuenta de tesorería configurada en <span className="font-mono">TREASURY_ACCOUNT_NUMBER</span>.
      </p>
    </div>
  )
}

export default DownloadsPanel

const accentColors: Record<'blue' | 'green' | 'purple', string> = {
  blue: 'border-brand-soft hover-border-brand-soft hover-bg-brand-soft',
  green: 'border-success-soft hover-border-success-soft hover-bg-success-soft',
  purple: 'border-violet-soft hover-border-violet-soft hover-bg-violet-soft',
}

const DownloadCard = ({
  href,
  title,
  description,
  accent,
  icon: Icon,
}: {
  href: string
  title: string
  description: string
  accent: 'blue' | 'green' | 'purple'
  icon: LucideIcon
}): JSX.Element => (
  <a
    href={href}
    download
    className={`block rounded-md border ${accentColors[accent]} bg-panel-inset px-4 py-3 transition-colors`}
  >
    <div className="flex items-start gap-3">
      <Icon className="size-5 shrink-0 text-brand" aria-hidden="true" />
      <div className="min-w-0">
        <p className="font-medium text-main">{title}</p>
        <p className="mt-1 text-xs text-muted leading-relaxed">{description}</p>
        <p className="mt-2 inline-flex items-center gap-1 text-xs text-brand">
          Descargar
          <ArrowRight className="size-3.5" aria-hidden="true" />
        </p>
      </div>
    </div>
  </a>
)

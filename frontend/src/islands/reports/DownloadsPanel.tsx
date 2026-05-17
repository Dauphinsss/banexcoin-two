import { useEffect, useState, type JSX } from 'react'
import {
  ArrowRight,
  BarChart3,
  Download,
  Info,
  Loader2,
  Scale,
  Send,
  type LucideIcon,
} from 'lucide-react'
import type { UploadSummary } from '@banex/types'
import { api } from '../../lib/api'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn, resolveUploadId } from '@/lib/utils'

interface DownloadsPanelProps {
  uploadId?: string
}

export const DownloadsPanel = ({ uploadId }: DownloadsPanelProps): JSX.Element | null => {
  const [upload, setUpload] = useState<UploadSummary | null>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading')

  useEffect(() => {
    let cancelled = false
    const load = async (): Promise<void> => {
      try {
        const resolvedId = resolveUploadId(uploadId)
        if (resolvedId) {
          const u = await api.getUpload(resolvedId)
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
    return <Skeleton className="h-24 w-full" />
  }

  if (status === 'error' || !upload) {
    return null
  }

  if (status === 'empty') {
    return (
      <Card className="border-dashed">
        <CardContent className="py-4 text-center text-sm text-muted-foreground">
          Las descargas estarán disponibles cuando el archivo termine de procesarse.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-2.5 p-3">
        <div className="flex min-w-0 items-center gap-2">
          <Download className="size-4 shrink-0 text-primary" />
          <div className="min-w-0">
            <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Descargas
            </h3>
            <p className="line-clamp-1 text-xs text-muted-foreground">
              Período{' '}
              <span className="font-mono text-foreground">{upload.period ?? '—'}</span> · archivo{' '}
              <span className="font-mono text-foreground">{upload.filename}</span>
            </p>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <DownloadCard
            href={api.reportUrl(upload.id)}
            title="Reporte Excel"
            description="Resumen general del procesamiento con los resultados del período."
            accent="primary"
            icon={BarChart3}
          />
          <DownloadCard
            href={api.banexTransferUrl(upload.id)}
            title="BanexTransfer"
            description="Archivo listo para preparar y ejecutar los pagos del período."
            accent="emerald"
            icon={Send}
          />
          <DownloadCard
            href={api.balanceSheetUrl(upload.id)}
            title="Cuadre DEBE/HABER"
            description="Cuadre operativo para revisar balance por usuario y por servicio."
            accent="violet"
            icon={Scale}
          />
        </div>
      </CardContent>
    </Card>
  )
}

export default DownloadsPanel

type Accent = 'primary' | 'emerald' | 'violet'

const ACCENT: Record<Accent, { border: string; bg: string; icon: string; hoverBorder: string }> = {
  primary: {
    border: 'border-primary/25',
    bg: 'bg-primary/[0.03]',
    icon: 'bg-primary/15 text-primary ring-primary/25',
    hoverBorder: 'hover:border-primary/50',
  },
  emerald: {
    border: 'border-emerald-500/25',
    bg: 'bg-emerald-500/[0.03]',
    icon: 'bg-emerald-500/15 text-emerald-300 ring-emerald-500/25',
    hoverBorder: 'hover:border-emerald-500/50',
  },
  violet: {
    border: 'border-violet-500/25',
    bg: 'bg-violet-500/[0.03]',
    icon: 'bg-violet-500/15 text-violet-300 ring-violet-500/25',
    hoverBorder: 'hover:border-violet-500/50',
  },
}

const filenameFromDisposition = (header: string | null, fallback: string): string => {
  if (!header) return fallback
  const star = /filename\*=(?:UTF-8'')?([^;]+)/i.exec(header)
  if (star?.[1]) return decodeURIComponent(star[1].trim().replace(/^"|"$/g, ''))
  const plain = /filename="?([^";]+)"?/i.exec(header)
  return plain?.[1]?.trim() ?? fallback
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
  accent: Accent
  icon: LucideIcon
}): JSX.Element => {
  const styles = ACCENT[accent]
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')

  // Descarga vía fetch+blob: el atributo `download` de <a> se ignora en
  // enlaces cross-origin (frontend :4321 → API :3000), por eso forzamos
  // el blob y disparamos la descarga con el nombre real del servidor.
  const download = async (): Promise<void> => {
    if (state === 'loading') return
    setState('loading')
    try {
      const res = await fetch(href)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const name = filenameFromDisposition(
        res.headers.get('content-disposition'),
        `${title}.xlsx`,
      )
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setState('idle')
    } catch {
      setState('error')
    }
  }

  return (
    <TooltipProvider delayDuration={120}>
      <button
        type="button"
        aria-label={`${title}: ${description}`}
        onClick={() => void download()}
        disabled={state === 'loading'}
        className={cn(
          'group block w-full rounded-md border px-2.5 py-2 text-left transition-[border-color,box-shadow,transform]',
          styles.border,
          styles.bg,
          styles.hoverBorder,
          'hover:-translate-y-0.5 hover:shadow-md hover:shadow-black/15',
          'disabled:cursor-progress disabled:opacity-80',
        )}
      >
        <div className="flex items-center gap-2">
          <div className={cn('grid size-7 shrink-0 place-items-center rounded-md ring-1', styles.icon)}>
            {state === 'loading' ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Icon className="size-4" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <p className="min-w-0 truncate text-sm font-medium text-foreground">{title}</p>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span
                    className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-border/80 bg-background/60 text-muted-foreground transition-colors hover:text-foreground"
                    onClick={(event) => event.stopPropagation()}
                    onPointerDown={(event) => event.stopPropagation()}
                  >
                    <Info className="size-3" aria-hidden="true" />
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-64">
                  {description}
                </TooltipContent>
              </Tooltip>
            </div>
            <span aria-live="polite">
              {state === 'error' ? (
                <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-destructive">
                  Error al descargar · reintentar
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </p>
              ) : (
                <p className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-primary transition-transform group-hover:translate-x-0.5">
                  {state === 'loading' ? 'Generando…' : 'Descargar'}
                  {state === 'loading' ? null : <ArrowRight className="size-3.5" aria-hidden="true" />}
                </p>
              )}
            </span>
          </div>
        </div>
      </button>
    </TooltipProvider>
  )
}

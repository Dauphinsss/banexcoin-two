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
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
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
    return <Skeleton className="h-44 w-full" />
  }

  if (status === 'error' || !upload) {
    return null
  }

  if (status === 'empty') {
    return (
        <Card className="border-dashed">
        <CardContent className="py-6 text-center text-sm text-muted-foreground">
          Las descargas estarán disponibles cuando el archivo termine de procesarse.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/15 text-primary ring-1 ring-primary/25">
            <Download className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold">Descargas operativas</h3>
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
              Período{' '}
              <span className="font-mono text-foreground">{upload.period ?? '—'}</span> · archivo{' '}
              <span className="font-mono text-foreground">{upload.filename}</span>
            </p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <DownloadCard
            href={api.reportUrl(upload.id)}
            title="Reporte Excel"
            description="Resumen general del procesamiento con los resultados del período."
            hoverTitle="Que incluye este reporte"
            hoverBody="Sirve para revision operativa y auditoria del cierre. Reune el resultado calculado del archivo con el contexto necesario para revisarlo fuera del sistema."
            accent="primary"
            icon={BarChart3}
          />
          <DownloadCard
            href={api.banexTransferUrl(upload.id)}
            title="BanexTransfer"
            description="Archivo listo para preparar y ejecutar los pagos del período."
            hoverTitle="Cuando usar BanexTransfer"
            hoverBody="Usalo cuando el cierre ya fue revisado y necesites llevar los pagos a la operacion. Es el archivo pensado para la etapa de ejecucion."
            accent="emerald"
            icon={Send}
          />
          <DownloadCard
            href={api.balanceSheetUrl(upload.id)}
            title="Cuadre DEBE/HABER"
            description="Cuadre operativo para revisar balance por usuario y por servicio."
            hoverTitle="Para que sirve este cuadre"
            hoverBody="Ayuda a contrastar lo calculado contra el balance operativo del periodo. Es util cuando necesitas revisar desbalances o preparar una validacion final."
            accent="violet"
            icon={Scale}
          />
        </div>

        <p className="text-xs text-muted-foreground">
          Las descargas corresponden al archivo seleccionado y se generan con la información procesada.
        </p>
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
  hoverTitle,
  hoverBody,
  accent,
  icon: Icon,
}: {
  href: string
  title: string
  description: string
  hoverTitle: string
  hoverBody: string
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
        onClick={() => void download()}
        disabled={state === 'loading'}
        className={cn(
          'group block w-full rounded-lg border p-4 text-left transition-[border-color,box-shadow,transform]',
          styles.border,
          styles.bg,
          styles.hoverBorder,
          'hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20',
          'disabled:cursor-progress disabled:opacity-80',
        )}
      >
        <div className="flex items-start gap-3">
          <div className={cn('grid size-9 shrink-0 place-items-center rounded-md ring-1', styles.icon)}>
            {state === 'loading' ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Icon className="size-4" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="font-medium text-foreground">{title}</p>
              <HoverCard openDelay={140} closeDelay={120}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HoverCardTrigger asChild>
                      <span
                        className="inline-flex size-5 shrink-0 items-center justify-center rounded-full border border-border/80 bg-background/60 text-muted-foreground transition-colors hover:text-foreground"
                        onClick={(event) => event.stopPropagation()}
                        onPointerDown={(event) => event.stopPropagation()}
                      >
                        <Info className="size-3" aria-hidden="true" />
                      </span>
                    </HoverCardTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="top">Mas contexto</TooltipContent>
                </Tooltip>
                <HoverCardContent side="top" align="start" className="w-72">
                  <div className="space-y-1.5">
                    <p className="text-sm font-semibold">{hoverTitle}</p>
                    <p className="text-xs leading-relaxed text-muted-foreground">{hoverBody}</p>
                  </div>
                </HoverCardContent>
              </HoverCard>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
            <span aria-live="polite">
              {state === 'error' ? (
                <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-destructive">
                  Error al descargar · reintentar
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </p>
              ) : (
                <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary transition-transform group-hover:translate-x-0.5">
                  {state === 'loading' ? 'Generando…' : `Descargar ${title}`}
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

import { useEffect, useMemo, useState, type JSX } from 'react'
import { CalendarClock, ChevronDown, FileCheck2 } from 'lucide-react'
import type { UploadSummary } from '@banex/types'
import { api } from '../../lib/api'
import { formatPeriodLabel } from '../../lib/format'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { cn, resolveUploadId } from '@/lib/utils'

export function UploadDocumentSelector(): JSX.Element | null {
  const [uploads, setUploads] = useState<UploadSummary[]>([])
  const [explicitId, setExplicitId] = useState<string | undefined>(undefined)
  const [status, setStatus] = useState<'loading' | 'ready' | 'empty' | 'error'>('loading')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load(): Promise<void> {
      try {
        const rows = await api.listUploads({ status: 'DONE' })
        if (!cancelled) {
          setUploads(rows)
          setExplicitId(resolveUploadId())
          setStatus(rows.length > 0 ? 'ready' : 'empty')
        }
      } catch {
        if (!cancelled) setStatus('error')
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const defaultUpload = uploads[0] ?? null
  const selected = useMemo(() => {
    if (!explicitId) return defaultUpload
    return uploads.find((upload) => upload.id === explicitId) ?? defaultUpload
  }, [defaultUpload, explicitId, uploads])
  const isDefault = Boolean(selected && selected.id === defaultUpload?.id && !explicitId)

  const chooseUpload = (uploadId: string): void => {
    if (!defaultUpload) return
    if (selected?.id === uploadId && !(uploadId === defaultUpload.id && explicitId)) return

    const next = new URL(window.location.href)
    next.searchParams.delete('id')

    if (uploadId === defaultUpload.id) {
      next.searchParams.delete('uploadId')
    } else {
      next.searchParams.set('uploadId', uploadId)
    }

    window.location.href = `${next.pathname}${next.search}${next.hash}`
  }

  if (status === 'loading') {
    return (
      <div className="hidden items-center gap-2 sm:flex" aria-hidden="true">
        <Skeleton className="h-8 w-48 rounded-md" />
      </div>
    )
  }

  if (status === 'empty') return null

  if (status === 'error') {
    return null
  }

  if (!selected) return null

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="document-selector-trigger group relative max-w-[44vw] justify-between gap-2 overflow-hidden border-border/70 bg-card/50 px-2.5 sm:max-w-80"
          title={selected.filename}
        >
          <span className="document-selector-sheen" aria-hidden="true" />
          <FileCheck2 data-icon="inline-start" aria-hidden="true" />
          <span className="document-selector-period hidden font-mono text-[11px] text-muted-foreground sm:inline">
            {formatPeriodLabel(selected.period)}
          </span>
          <span className="min-w-0 truncate text-left text-xs font-medium">
            {selected.filename}
          </span>
          <ChevronDown
            data-icon="inline-end"
            aria-hidden="true"
            className={cn('selector-chevron', open && 'selector-chevron-open')}
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="document-selector-menu w-[min(28rem,calc(100vw-2rem))]"
      >
        <DropdownMenuLabel className="document-selector-label">Documento</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={selected.id} onValueChange={chooseUpload}>
          {uploads.map((upload, index) => (
            <DropdownMenuRadioItem
              key={upload.id}
              value={upload.id}
              className="document-selector-item items-start"
              style={{ animationDelay: `${index * 28}ms` }}
            >
              <span className="grid min-w-0 gap-0.5">
                <span className="truncate font-medium">{upload.filename}</span>
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <CalendarClock aria-hidden="true" />
                    {formatPeriodLabel(upload.period)}
                  </span>
                  <span>{upload.rebateCount.toLocaleString('es-BO')} reintegros</span>
                  <span>{upload.anomalyCount.toLocaleString('es-BO')} anomalías</span>
                  {index === 0 ? <span>default</span> : null}
                </span>
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        {!isDefault ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() => defaultUpload && chooseUpload(defaultUpload.id)}
              className="document-selector-reset text-xs text-muted-foreground"
            >
              Volver al último procesado
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

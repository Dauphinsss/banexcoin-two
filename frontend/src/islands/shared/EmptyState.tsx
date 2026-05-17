import type { JSX, ReactNode } from 'react'
import { ArrowRight, FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  /** Texto pequeño superior (eyebrow). */
  eyebrow?: string
  /** Título principal. */
  title: string
  /** Descripción de una o dos líneas. */
  description: string
  /** Texto del CTA principal. */
  ctaLabel?: string
  /** Destino del CTA principal. */
  ctaHref?: string
  /** Icono opcional (por defecto: hoja de cálculo). */
  icon?: ReactNode
}

/**
 * Estado vacío unificado para todas las vistas que dependen de un
 * upload procesado. Diseño consistente con la marca (glow ambiental,
 * icono en disco, CTA primario) para que el primer uso sea guiado y
 * profesional en lugar de un texto suelto distinto por pantalla.
 */
export function EmptyState({
  eyebrow = 'Empieza aquí',
  title,
  description,
  ctaLabel = 'Subir Excel',
  ctaHref = '/uploads/new',
  icon,
}: EmptyStateProps): JSX.Element {
  return (
    <div className="relative overflow-hidden rounded-xl border border-dashed border-border bg-card/50">
      {/* Glow ambiental de marca */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-primary/15 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 left-1/4 h-48 w-48 rounded-full bg-violet-500/10 blur-3xl"
      />

      <div className="relative flex flex-col items-center gap-5 px-6 py-14 text-center sm:py-16">
        <div className="grid size-16 place-items-center rounded-2xl bg-primary/15 text-primary ring-1 ring-primary/25">
          {icon ?? <FileSpreadsheet className="size-7" aria-hidden="true" />}
        </div>

        <div className="space-y-2">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-primary">
            {eyebrow}
          </p>
          <h2 className="text-balance text-xl font-semibold tracking-tight md:text-2xl">
            {title}
          </h2>
          <p className="mx-auto max-w-md text-pretty text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        </div>

        <Button asChild size="lg">
          <a href={ctaHref}>
            {ctaLabel}
            <ArrowRight aria-hidden="true" />
          </a>
        </Button>
      </div>
    </div>
  )
}

export default EmptyState

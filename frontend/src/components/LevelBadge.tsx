import { cn } from '@/lib/utils'

type LevelBadgeVariant = 'solid' | 'soft' | 'outline' | 'dot'

interface LevelBadgeProps {
  levelName?: string | null
  variant?: LevelBadgeVariant
  className?: string
}

const LEVEL_COLORS: Record<string, string> = {
  base: '#94a3b8',
  basico: '#94a3b8',
  bronce: '#d97706',
  plata: '#cbd5e1',
  oro: '#eab308',
  platino: '#818cf8',
}

const FALLBACK_COLOR = '#94a3b8'

const normalizeLevelName = (name: string): string =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()

export const getLevelColor = (levelName?: string | null): string => {
  if (!levelName) return FALLBACK_COLOR
  return LEVEL_COLORS[normalizeLevelName(levelName)] ?? FALLBACK_COLOR
}

const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const clean = hex.replace('#', '')
  return {
    r: Number.parseInt(clean.slice(0, 2), 16),
    g: Number.parseInt(clean.slice(2, 4), 16),
    b: Number.parseInt(clean.slice(4, 6), 16),
  }
}

const rgba = (hex: string, alpha: number): string => {
  const { r, g, b } = hexToRgb(hex)
  return `rgb(${r} ${g} ${b} / ${alpha})`
}

const readableText = (hex: string): string => {
  const { r, g, b } = hexToRgb(hex)
  const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return luminance > 0.62 ? '#171724' : '#ffffff'
}

export function LevelBadge({
  levelName,
  variant = 'soft',
  className,
}: LevelBadgeProps) {
  const label = levelName ?? 'Sin nivel'
  const color = getLevelColor(levelName)

  if (variant === 'dot') {
    return (
      <span className={cn('inline-flex min-w-0 items-center gap-2 text-sm text-foreground', className)}>
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />
        <span className="truncate">{label}</span>
      </span>
    )
  }

  const style =
    variant === 'solid'
      ? {
          backgroundColor: color,
          borderColor: color,
          color: readableText(color),
        }
      : variant === 'outline'
        ? {
            backgroundColor: 'transparent',
            borderColor: rgba(color, 0.58),
            color,
          }
        : {
            backgroundColor: rgba(color, 0.14),
            borderColor: rgba(color, 0.42),
            color,
          }

  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold leading-5',
        variant !== 'solid' && 'shadow-[inset_0_1px_0_rgb(255_255_255/0.05)]',
        className,
      )}
      style={style}
    >
      <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className="truncate">{label}</span>
    </span>
  )
}

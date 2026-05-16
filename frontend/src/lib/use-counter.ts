import { useEffect, useState } from 'react'

/**
 * Hook que anima un contador de 0 al valor target en `durationMs`.
 * Respeta `prefers-reduced-motion`.
 */
export const useCounter = (target: number, durationMs = 800): number => {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!Number.isFinite(target)) {
      setValue(0)
      return
    }

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    if (prefersReduced || durationMs <= 0) {
      setValue(target)
      return
    }

    let raf: number
    const start = performance.now()

    const tick = (now: number): void => {
      const elapsed = now - start
      const progress = Math.min(elapsed / durationMs, 1)
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setValue(target * eased)
      if (progress < 1) raf = requestAnimationFrame(tick)
      else setValue(target)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, durationMs])

  return value
}

import { describe, it, expect } from 'vitest'
import { detectPeriod } from './period.js'

describe('detectPeriod', () => {
  it('devuelve null y warning NO_DATES si no hay fechas válidas', () => {
    const result = detectPeriod([null, undefined, '', 'abc'])
    expect(result.period).toBeNull()
    expect(result.warning?.type).toBe('NO_DATES')
  })

  it('detecta un único mes desde fechas Date', () => {
    const result = detectPeriod([
      new Date(Date.UTC(2025, 4, 1)),
      new Date(Date.UTC(2025, 4, 15)),
      new Date(Date.UTC(2025, 4, 31)),
    ])
    expect(result.period).toBe('2025-05')
    expect(result.warning).toBeNull()
  })

  it('parsea strings en formato DD/MM/YYYY del Excel original', () => {
    const result = detectPeriod([
      '15/04/2025 09:01:55, UTC -04:00',
      '15/04/2025 09:38:18, UTC -04:00',
      '20/04/2025 12:00:00, UTC -04:00',
    ])
    expect(result.period).toBe('2025-04')
  })

  it('advierte cuando hay múltiples meses con minoría >10%', () => {
    const result = detectPeriod([
      // 8 de abril, 2 de mayo → 20% minoría
      new Date(Date.UTC(2025, 3, 1)),
      new Date(Date.UTC(2025, 3, 2)),
      new Date(Date.UTC(2025, 3, 3)),
      new Date(Date.UTC(2025, 3, 4)),
      new Date(Date.UTC(2025, 3, 5)),
      new Date(Date.UTC(2025, 3, 6)),
      new Date(Date.UTC(2025, 3, 7)),
      new Date(Date.UTC(2025, 3, 8)),
      new Date(Date.UTC(2025, 4, 1)),
      new Date(Date.UTC(2025, 4, 2)),
    ])
    expect(result.period).toBe('2025-04')
    expect(result.warning?.type).toBe('MULTIPLE_MONTHS')
    expect(result.monthsFound).toHaveLength(2)
  })

  it('no advierte si la minoría es <=10% (caso datos reales abril-mayo del Excel)', () => {
    // 95 filas de abril, 5 filas de mayo → 5% minoría
    const dates: Date[] = []
    for (let i = 1; i <= 95; i++) dates.push(new Date(Date.UTC(2025, 3, (i % 30) + 1)))
    for (let i = 1; i <= 5; i++) dates.push(new Date(Date.UTC(2025, 4, i)))
    const result = detectPeriod(dates)
    expect(result.period).toBe('2025-04')
    expect(result.warning).toBeNull()
  })

  it('mes mayoritario gana cuando hay empate cercano', () => {
    const result = detectPeriod([
      new Date(Date.UTC(2025, 4, 1)),
      new Date(Date.UTC(2025, 4, 2)),
      new Date(Date.UTC(2025, 4, 3)),
      new Date(Date.UTC(2025, 3, 1)),
      new Date(Date.UTC(2025, 3, 2)),
    ])
    expect(result.period).toBe('2025-05')
  })
})

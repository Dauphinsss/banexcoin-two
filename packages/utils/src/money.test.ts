import { describe, it, expect } from 'vitest'
import { D, bob, usdt, isCloseTo, weightedAverage, formatBOB, formatUSDT, formatPercent } from './money.js'

describe('D (constructor seguro)', () => {
  it('acepta strings con decimales', () => {
    expect(D('150.00').toString()).toBe('150')
    expect(D('13.20650000').toFixed(8)).toBe('13.20650000')
  })

  it('acepta números enteros pequeños sin pérdida', () => {
    expect(D(150).toString()).toBe('150')
  })

  it('lanza en valores no numéricos', () => {
    expect(() => D('abc')).toThrow(/Invalid decimal/)
  })

  it('preserva precisión más allá de IEEE-754', () => {
    const result = D('0.1').plus(D('0.2'))
    expect(result.toFixed(1)).toBe('0.3')
  })
})

describe('bob / usdt formatters de persistencia', () => {
  it('bob fuerza 2 decimales', () => {
    expect(bob('150')).toBe('150.00')
    expect(bob('150.999')).toBe('151.00') // ROUND_HALF_EVEN
    expect(bob('150.005')).toBe('150.00') // banker: 0 par mantenido
    expect(bob('150.015')).toBe('150.02') // banker: 2 par
  })

  it('usdt fuerza 8 decimales', () => {
    expect(usdt('0.378')).toBe('0.37800000')
    expect(usdt('1')).toBe('1.00000000')
  })
})

describe('isCloseTo', () => {
  it('compara con tolerancia default 0.01', () => {
    expect(isCloseTo('100.00', '100.005')).toBe(true)
    expect(isCloseTo('100.00', '100.02')).toBe(false)
  })

  it('acepta tolerancia custom', () => {
    expect(isCloseTo('100.00', '100.50', '1.00')).toBe(true)
    expect(isCloseTo('100.00', '100.50', '0.10')).toBe(false)
  })
})

describe('weightedAverage', () => {
  it('devuelve 0 si el array está vacío', () => {
    expect(weightedAverage([])).toBe('0')
  })

  it('devuelve 0 si todos los pesos son cero', () => {
    expect(
      weightedAverage([
        { value: '10', weight: '0' },
        { value: '20', weight: '0' },
      ]),
    ).toBe('0')
  })

  it('promedio simple cuando todos los pesos son iguales', () => {
    const result = weightedAverage([
      { value: '10', weight: '1' },
      { value: '20', weight: '1' },
      { value: '30', weight: '1' },
    ])
    expect(D(result).toFixed(2)).toBe('20.00')
  })

  it('promedio ponderado: pondera correctamente', () => {
    // 3 transacciones a tasas distintas
    // Tasa final = (100*13 + 200*14 + 700*15) / (100+200+15) ...
    // Mejor caso concreto:
    // BOB 100 a tasa 10 → contribuye 1000
    // BOB 900 a tasa 20 → contribuye 18000
    // Total: 19000 / 1000 = 19 (no 15 que sería el simple)
    const result = weightedAverage([
      { value: '10', weight: '100' },
      { value: '20', weight: '900' },
    ])
    expect(D(result).toFixed(2)).toBe('19.00')
  })

  it('mantiene 8 decimales en el resultado', () => {
    const result = weightedAverage([
      { value: '13.20650000', weight: '5' },
      { value: '13.20660000', weight: '5' },
    ])
    expect(result).toMatch(/^\d+\.\d{8}$/)
  })
})

describe('formatters de UI', () => {
  it('formatBOB con separadores en formato es-BO', () => {
    expect(formatBOB('1234.56')).toMatch(/Bs\s.*1.*234.*56/)
  })

  it('formatUSDT con 8 decimales', () => {
    expect(formatUSDT('1234.5')).toContain('USDT')
    expect(formatUSDT('1234.5')).toMatch(/\.50000000/)
  })

  it('formatPercent con 2 decimales y signo %', () => {
    expect(formatPercent('2.5')).toBe('2.50%')
    expect(formatPercent('1.999')).toBe('2.00%')
  })
})

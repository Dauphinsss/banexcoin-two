import { describe, it, expect } from 'vitest'
import { validateTiers, type TierValidationInput } from './tier-validation.js'

const baseTiers: TierValidationInput[] = [
  { id: 1, level: 1, name: 'Básico', minAmountBOB: '0', maxAmountBOB: '500', rebatePercent: '1.00' },
  { id: 2, level: 2, name: 'Bronce', minAmountBOB: '500.01', maxAmountBOB: '1000', rebatePercent: '1.50' },
  { id: 3, level: 3, name: 'Plata', minAmountBOB: '1000.01', maxAmountBOB: '2500', rebatePercent: '2.00' },
  { id: 4, level: 4, name: 'Oro', minAmountBOB: '2500.01', maxAmountBOB: '5000', rebatePercent: '2.50' },
  { id: 5, level: 5, name: 'Platino', minAmountBOB: '5000.01', maxAmountBOB: null, rebatePercent: '3.00' },
]

describe('validateTiers', () => {
  it('configuración seed válida no tiene errores', () => {
    const result = validateTiers(baseTiers)
    expect(result.valid).toBe(true)
    expect(result.blockingCount).toBe(0)
  })

  it('lista vacía es válida', () => {
    const result = validateTiers([])
    expect(result.valid).toBe(true)
    expect(result.conflicts).toHaveLength(0)
  })

  it('detecta solapamiento como error', () => {
    const result = validateTiers([
      ...baseTiers.slice(0, 1),
      { id: 99, level: 2, name: 'Solapado', minAmountBOB: '300', maxAmountBOB: '600', rebatePercent: '1.50' },
    ])
    expect(result.valid).toBe(false)
    expect(result.conflicts.some((c) => c.type === 'OVERLAP' && c.severity === 'error')).toBe(true)
  })

  it('detecta hueco como warning, no como error', () => {
    const result = validateTiers([
      { id: 1, level: 1, name: 'Básico', minAmountBOB: '0', maxAmountBOB: '500', rebatePercent: '1.00' },
      { id: 2, level: 2, name: 'Plata', minAmountBOB: '1000', maxAmountBOB: '2500', rebatePercent: '2.00' },
    ])
    expect(result.valid).toBe(true) // huecos no bloquean
    expect(result.warningCount).toBeGreaterThan(0)
    expect(result.conflicts.some((c) => c.type === 'GAP')).toBe(true)
  })

  it('detecta rango invertido (min > max)', () => {
    const result = validateTiers([
      { id: 1, level: 1, name: 'Invertido', minAmountBOB: '1000', maxAmountBOB: '500', rebatePercent: '1.00' },
    ])
    expect(result.valid).toBe(false)
    expect(result.conflicts.some((c) => c.type === 'INVERTED_RANGE')).toBe(true)
  })

  it('detecta porcentajes negativos', () => {
    const result = validateTiers([
      { id: 1, level: 1, name: 'Neg', minAmountBOB: '0', maxAmountBOB: '500', rebatePercent: '-1' },
    ])
    expect(result.valid).toBe(false)
    expect(result.conflicts.some((c) => c.type === 'NEGATIVE')).toBe(true)
  })

  it('detecta duplicado de level', () => {
    const result = validateTiers([
      { id: 'a', level: 1, name: 'Uno', minAmountBOB: '0', maxAmountBOB: '500', rebatePercent: '1' },
      { id: 'b', level: 1, name: 'Otro Uno', minAmountBOB: '600', maxAmountBOB: '1000', rebatePercent: '2' },
    ])
    expect(result.valid).toBe(false)
    const dup = result.conflicts.find((c) => c.type === 'DUPLICATE_LEVEL')
    expect(dup).toBeDefined()
    expect(dup?.tierIds).toEqual(['a', 'b'])
  })

  it('warning si ningún tier tiene tope abierto (NO_OPEN_TOP)', () => {
    const result = validateTiers([
      { id: 1, level: 1, name: 'A', minAmountBOB: '0', maxAmountBOB: '500', rebatePercent: '1' },
      { id: 2, level: 2, name: 'B', minAmountBOB: '500.01', maxAmountBOB: '1000', rebatePercent: '2' },
    ])
    expect(result.conflicts.some((c) => c.type === 'NO_OPEN_TOP')).toBe(true)
  })

  it('warning si rebatePercent > 100', () => {
    const result = validateTiers([
      { id: 1, level: 1, name: 'Loco', minAmountBOB: '0', maxAmountBOB: null, rebatePercent: '150' },
    ])
    expect(result.conflicts.some((c) => c.type === 'HIGH_PERCENT')).toBe(true)
  })

  it('error si un tier sin tope tiene otro tier mayor después', () => {
    const result = validateTiers([
      { id: 1, level: 1, name: 'Abierto', minAmountBOB: '0', maxAmountBOB: null, rebatePercent: '1' },
      { id: 2, level: 2, name: 'Imposible', minAmountBOB: '1000', maxAmountBOB: '2000', rebatePercent: '2' },
    ])
    expect(result.valid).toBe(false)
    expect(result.conflicts.some((c) => c.type === 'OVERLAP')).toBe(true)
  })

  it('reconoce maxAmountBOB === null como tope abierto (no error solo por null)', () => {
    const result = validateTiers([
      { id: 1, level: 1, name: 'A', minAmountBOB: '0', maxAmountBOB: '500', rebatePercent: '1' },
      { id: 2, level: 2, name: 'Top', minAmountBOB: '500.01', maxAmountBOB: null, rebatePercent: '3' },
    ])
    expect(result.valid).toBe(true)
    expect(result.warningCount).toBe(0)
  })

  it('valores no numéricos producen error NEGATIVE', () => {
    const result = validateTiers([
      { id: 1, level: 1, name: 'Bad', minAmountBOB: 'abc', maxAmountBOB: 'xyz', rebatePercent: '1' },
    ])
    expect(result.valid).toBe(false)
  })
})

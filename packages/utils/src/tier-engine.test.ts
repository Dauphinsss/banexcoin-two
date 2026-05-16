import { describe, it, expect } from 'vitest'
import { calculateRebates, type TierEngineTier, type TierEngineTransaction } from './tier-engine.js'
import { D } from './money.js'

const TIERS: TierEngineTier[] = [
  { id: 1, name: 'Básico',  minAmountBOB: '0',     maxAmountBOB: '500',   rebatePercent: '1.00' },
  { id: 2, name: 'Bronce',  minAmountBOB: '500.01', maxAmountBOB: '1000', rebatePercent: '1.50' },
  { id: 3, name: 'Plata',   minAmountBOB: '1000.01', maxAmountBOB: '2500', rebatePercent: '2.00' },
  { id: 4, name: 'Oro',     minAmountBOB: '2500.01', maxAmountBOB: '5000', rebatePercent: '2.50' },
  { id: 5, name: 'Platino', minAmountBOB: '5000.01', maxAmountBOB: null,   rebatePercent: '3.00' },
]

const tx = (
  userId: number,
  amountBOB: string,
  exchangeRate: string,
  amountUSDT?: string,
): TierEngineTransaction => ({
  userId,
  amountBOB,
  exchangeRate,
  amountUSDT: amountUSDT ?? D(amountBOB).dividedBy(D(exchangeRate)).toFixed(8),
})

describe('calculateRebates', () => {
  describe('asignación de tier', () => {
    it('asigna Nivel Básico cuando el gasto está en el rango inicial', () => {
      const result = calculateRebates({
        transactions: [tx(1, '100', '13')],
        tiers: TIERS,
      })
      expect(result[0]?.tierId).toBe(1)
      expect(result[0]?.tierName).toBe('Básico')
    })

    it('asigna Nivel 1 exactamente en el mínimo', () => {
      const result = calculateRebates({
        transactions: [tx(1, '0.01', '13')],
        tiers: TIERS,
      })
      expect(result[0]?.tierId).toBe(1)
    })

    it('asigna Nivel 1 exactamente en el máximo', () => {
      const result = calculateRebates({
        transactions: [tx(1, '500', '13')],
        tiers: TIERS,
      })
      expect(result[0]?.tierId).toBe(1)
    })

    it('cruza la frontera: 500 → Básico, 500.01 → Bronce', () => {
      const a = calculateRebates({
        transactions: [tx(1, '500.00', '13')],
        tiers: TIERS,
      })
      const b = calculateRebates({
        transactions: [tx(2, '500.01', '13')],
        tiers: TIERS,
      })
      expect(a[0]?.tierId).toBe(1)
      expect(b[0]?.tierId).toBe(2)
    })

    it('asigna Platino sin tope superior para gastos muy altos', () => {
      const result = calculateRebates({
        transactions: [tx(1, '999999.99', '13')],
        tiers: TIERS,
      })
      expect(result[0]?.tierId).toBe(5)
      expect(result[0]?.tierName).toBe('Platino')
    })

    it('devuelve tierId null si no cae en ningún tier (mínimo > 0)', () => {
      const TIERS_FROM_100: TierEngineTier[] = [
        { id: 1, name: 'A', minAmountBOB: '100', maxAmountBOB: '500', rebatePercent: '1.00' },
      ]
      const result = calculateRebates({
        transactions: [tx(1, '50', '13')],
        tiers: TIERS_FROM_100,
      })
      expect(result[0]?.tierId).toBeNull()
      expect(result[0]?.rebateBOB).toBe('0.00')
      expect(result[0]?.rebateUSDT).toBe('0.00000000')
    })

    it('funciona con tiers desordenados de entrada', () => {
      const shuffled = [TIERS[4], TIERS[0], TIERS[3], TIERS[1], TIERS[2]].filter(
        (t): t is TierEngineTier => t !== undefined,
      )
      const result = calculateRebates({
        transactions: [tx(1, '1500', '13')],
        tiers: shuffled,
      })
      expect(result[0]?.tierId).toBe(3)
    })
  })

  describe('cálculo del reintegro', () => {
    it('aplica el porcentaje del tier sobre el total gastado', () => {
      const result = calculateRebates({
        transactions: [tx(1, '1000', '13')],
        tiers: TIERS,
      })
      // 1000 en Bronce 1.5% = 15 BOB
      expect(result[0]?.rebateBOB).toBe('15.00')
    })

    it('calcula el USDT desde el monto intercambio histórico del Excel', () => {
      const result = calculateRebates({
        transactions: [
          tx(1, '100', '10'),
          tx(1, '900', '20'),
        ],
        tiers: TIERS,
      })
      // Total: 1000 BOB → Bronce 1.5% = 15 BOB
      // Total USDT histórico: 10 + 45 = 55
      // Rebate USDT: 55 * 1.5% = 0.825
      expect(result[0]?.totalSpentBOB).toBe('1000.00')
      expect(result[0]?.avgExchangeRate).toBe('18.18181818')
      expect(result[0]?.rebateBOB).toBe('15.00')
      expect(result[0]?.rebateUSDT).toBe('0.82500000')
    })

    it('deduce el tipo de cambio promedio como total BOB / total USDT', () => {
      const result = calculateRebates({
        transactions: [
          tx(1, '100', '99', '10'),
          tx(1, '900', '99', '45'),
        ],
        tiers: TIERS,
      })
      expect(result[0]?.avgExchangeRate).toBe('18.18181818')
    })
  })

  describe('agrupación por usuario', () => {
    it('separa correctamente transacciones de usuarios distintos', () => {
      const result = calculateRebates({
        transactions: [
          tx(1, '100', '13'),
          tx(2, '200', '13'),
          tx(1, '300', '13'),
        ],
        tiers: TIERS,
      })
      expect(result).toHaveLength(2)
      const u1 = result.find((r) => r.userId === 1)
      const u2 = result.find((r) => r.userId === 2)
      expect(u1?.totalSpentBOB).toBe('400.00')
      expect(u1?.transactionCount).toBe(2)
      expect(u2?.totalSpentBOB).toBe('200.00')
      expect(u2?.transactionCount).toBe(1)
    })

    it('ordena el output por userId ascendente de forma determinista', () => {
      const result = calculateRebates({
        transactions: [
          tx(3, '100', '13'),
          tx(1, '100', '13'),
          tx(2, '100', '13'),
        ],
        tiers: TIERS,
      })
      expect(result.map((r) => r.userId)).toEqual([1, 2, 3])
    })
  })

  describe('casos borde', () => {
    it('devuelve array vacío si no hay transacciones', () => {
      const result = calculateRebates({ transactions: [], tiers: TIERS })
      expect(result).toEqual([])
    })

    it('asigna rebate 0 si no hay tiers configurados', () => {
      const result = calculateRebates({
        transactions: [tx(1, '1000', '13')],
        tiers: [],
      })
      expect(result[0]?.tierId).toBeNull()
      expect(result[0]?.rebateBOB).toBe('0.00')
    })

    it('no muta los inputs', () => {
      const transactions = [tx(1, '100', '13')]
      const tiers = [...TIERS]
      const tiersBefore = JSON.stringify(tiers)
      const txsBefore = JSON.stringify(transactions)

      calculateRebates({ transactions, tiers })

      expect(JSON.stringify(tiers)).toBe(tiersBefore)
      expect(JSON.stringify(transactions)).toBe(txsBefore)
    })

    it('todos los montos en el output respetan precisión declarada', () => {
      const result = calculateRebates({
        transactions: [tx(1, '1234.567', '13.2065')],
        tiers: TIERS,
      })
      expect(result[0]?.totalSpentBOB).toMatch(/^\d+\.\d{2}$/)
      expect(result[0]?.rebateBOB).toMatch(/^\d+\.\d{2}$/)
      expect(result[0]?.rebateUSDT).toMatch(/^\d+\.\d{8}$/)
      expect(result[0]?.avgExchangeRate).toMatch(/^\d+\.\d{8}$/)
      expect(result[0]?.rebatePercent).toMatch(/^\d+\.\d{2}$/)
    })
  })

  describe('volumen', () => {
    it('procesa 5000 transacciones sin error', () => {
      const transactions: TierEngineTransaction[] = []
      for (let i = 0; i < 5000; i++) {
        transactions.push(tx((i % 250) + 1, '50', '13.50'))
      }
      const result = calculateRebates({ transactions, tiers: TIERS })
      expect(result).toHaveLength(250)
    })
  })
})

/**
 * Seed inicial: 5 niveles de cashback con la estructura sugerida por el brief.
 * Ejecutar con: `bun run --cwd backend prisma:seed`.
 *
 * Idempotente: busca el tier vigente por level + validFromPeriod y luego actualiza o crea.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const SEED_TIERS = [
  { level: 1, name: 'Basico', minAmountBOB: '0', maxAmountBOB: '500', rebatePercent: '1.00' },
  { level: 2, name: 'Bronce', minAmountBOB: '500.01', maxAmountBOB: '1000', rebatePercent: '1.50' },
  { level: 3, name: 'Plata', minAmountBOB: '1000.01', maxAmountBOB: '2500', rebatePercent: '2.00' },
  { level: 4, name: 'Oro', minAmountBOB: '2500.01', maxAmountBOB: '5000', rebatePercent: '2.50' },
  { level: 5, name: 'Platino', minAmountBOB: '5000.01', maxAmountBOB: null, rebatePercent: '3.00' },
] as const

async function main(): Promise<void> {
  const validFromPeriod = '2025-01'
  const validToPeriod = null

  for (const tier of SEED_TIERS) {
    const existing = await prisma.cashbackTier.findFirst({
      where: {
        level: tier.level,
        validFromPeriod,
      },
    })

    if (existing) {
      await prisma.cashbackTier.update({
        where: { id: existing.id },
        data: {
          name: tier.name,
          minAmountBOB: tier.minAmountBOB,
          maxAmountBOB: tier.maxAmountBOB,
          rebatePercent: tier.rebatePercent,
          validToPeriod,
          active: true,
        },
      })
      continue
    }

    await prisma.cashbackTier.create({
      data: {
        level: tier.level,
        name: tier.name,
        minAmountBOB: tier.minAmountBOB,
        maxAmountBOB: tier.maxAmountBOB,
        rebatePercent: tier.rebatePercent,
        validFromPeriod,
        validToPeriod,
        active: true,
      },
    })
  }

  console.log(`Seed completado: ${SEED_TIERS.length} niveles cargados.`)
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(() => {
    void prisma.$disconnect()
  })

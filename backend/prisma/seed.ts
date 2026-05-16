/**
 * Seed inicial: 5 niveles de cashback con la estructura sugerida por el brief.
 * Ejecutar con: `bun run --cwd backend prisma:seed`.
 *
 * Idempotente: usa upsert por nombre del tier.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const SEED_TIERS = [
  { id: 1, name: 'Básico',  minAmountBOB: '0',       maxAmountBOB: '500',    rebatePercent: '1.00' },
  { id: 2, name: 'Bronce',  minAmountBOB: '500.01',  maxAmountBOB: '1000',   rebatePercent: '1.50' },
  { id: 3, name: 'Plata',   minAmountBOB: '1000.01', maxAmountBOB: '2500',   rebatePercent: '2.00' },
  { id: 4, name: 'Oro',     minAmountBOB: '2500.01', maxAmountBOB: '5000',   rebatePercent: '2.50' },
  { id: 5, name: 'Platino', minAmountBOB: '5000.01', maxAmountBOB: null,     rebatePercent: '3.00' },
] as const

async function main(): Promise<void> {
  const validFrom = new Date('2025-01-01T00:00:00.000Z')

  for (const tier of SEED_TIERS) {
    await prisma.cashbackTier.upsert({
      where: { id: tier.id },
      create: {
        id: tier.id,
        name: tier.name,
        minAmountBOB: tier.minAmountBOB,
        maxAmountBOB: tier.maxAmountBOB,
        rebatePercent: tier.rebatePercent,
        active: true,
        validFrom,
      },
      update: {
        name: tier.name,
        minAmountBOB: tier.minAmountBOB,
        maxAmountBOB: tier.maxAmountBOB,
        rebatePercent: tier.rebatePercent,
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

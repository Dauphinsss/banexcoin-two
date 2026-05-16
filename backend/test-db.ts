// @ts-nocheck
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('[INFO] Conectando a AWS RDS PostgreSQL...');

    // 1. Intentamos hacer una consulta directa para ver si responde
    // Reemplaza 'user' por algún modelo que tengas en tu schema.prisma (ej. user, transaction, etc.)
    // Si tus modelos empiezan con mayúscula, ponle 'prisma.user.findMany()' en minúscula aquí.
    const resultado = await (prisma as any).userAccount.findMany();

    console.log('[OK] Conexion exitosa con AWS.');
    console.log('Datos actuales en la nube:', resultado);
}

main()
    .catch((e) => {
        console.error('[ERROR] Error de conexion:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

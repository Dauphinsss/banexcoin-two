/**
 * Identidad visual unificada para las exportaciones Excel de BanexReintegra.
 *
 * Aplica la marca Banexcoin (naranja #FF5D30 / #FF8E0A) con un acabado
 * profesional: fuente consistente, cabecera de marca, encabezados de tabla
 * con relleno, zebra striping, bordes hairline, alineación numérica y filas
 * de total destacadas.
 *
 * Importante: estos helpers SOLO aplican estilo. No alteran qué datos van en
 * qué celda — la fila 1 sigue siendo el encabezado y los datos empiezan en la
 * fila 2, preservando los contratos de los servicios y de las pruebas.
 */
import type ExcelJS from 'exceljs'

// Paleta de marca (ARGB para ExcelJS).
export const BRAND = {
  orange: 'FFFF5D30',
  orangeDeep: 'FFE8451C',
  amber: 'FFFF8E0A',
  ink: 'FF0F1A2D',
  headerText: 'FFFFFFFF',
  rowAlt: 'FFF6F7FB', // zebra striping muy tenue
  border: 'FFE2E8F0',
  borderStrong: 'FFCBD5E1',
  totalFill: 'FFFFF1EC', // naranja casi blanco para la fila TOTAL
  subtle: 'FF64748B',
  // Colores semánticos para valores (iguales a las tablas de la UI):
  success: 'FF1A8F5A', // verde reintegros / USDT / montos positivos
  danger: 'FFD92D20', // rojo saldos negativos / pagos
  mono: 'FF334155', // gris para columnas técnicas (IDs, fechas)
} as const

/**
 * Anchos mínimos recomendados por tipo de número, para que Excel nunca
 * muestre `####`/`$$$$` por columna estrecha. Un número con 8 decimales
 * más separadores de miles ("1,234,567.12345678") necesita ~22 chars.
 */
export const COL_WIDTH = {
  usdt: 22, // #,##0.00000000
  bob: 16, // #,##0.00
  rate: 16, // 0.00000000
  percent: 13, // 0.00"%"
  int: 12,
} as const

export const FONT = 'Arial'

/**
 * Resuelve qué números de columna son numéricos a partir de sus `key`s,
 * para alinear encabezado y datos de forma consistente.
 */
const resolveNumericCols = (
  ws: ExcelJS.Worksheet,
  numericKeys: string[],
): Set<number> =>
  new Set(
    ws.columns
      .map((c, i) => (c.key && numericKeys.includes(c.key) ? i + 1 : 0))
      .filter((n) => n > 0),
  )

/**
 * Garantiza que cada columna sea al menos tan ancha como su título de
 * encabezado en una sola línea (negrita 11pt ≈ 1.25 unidades por carácter,
 * más el sangrado/holgura). Nunca encoge columnas que ya son más anchas por
 * sus datos. `finishTable` ya lo invoca; exportado por si se necesita suelto.
 */
export const fitHeaderWidths = (ws: ExcelJS.Worksheet): void => {
  ws.columns.forEach((col) => {
    const header = Array.isArray(col.header) ? col.header.join(' ') : col.header
    if (!header) return
    const needed = Math.ceil(String(header).length * 1.25) + 3
    col.width = Math.max(col.width ?? 0, needed)
  })
}

/**
 * Estiliza la fila de encabezado de tabla con la identidad de marca.
 *
 * - Texto blanco, negrita, en **una sola línea** (sin wrap): las columnas
 *   se ensanchan con `fitHeaderWidths` para que el título nunca se corte.
 * - Centrado vertical; horizontalmente cada celda se alinea como sus datos
 *   (numéricas a la derecha, texto a la izquierda) para quedar cuadradas.
 * - Relleno de marca con borde superior/inferior reforzado para que el
 *   encabezado se lea como un bloque sólido, coherente con las filas.
 */
export const styleTableHeader = (
  row: ExcelJS.Row,
  opts: { fill?: string; numericCols?: Set<number> } = {},
): void => {
  const fill = opts.fill ?? BRAND.orangeDeep
  const numeric = opts.numericCols ?? new Set<number>()
  row.height = 24
  row.eachCell((cell, colNumber) => {
    cell.font = {
      name: FONT,
      bold: true,
      size: 11,
      color: { argb: BRAND.headerText },
    }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } }
    cell.alignment = {
      vertical: 'middle',
      horizontal: numeric.has(colNumber) ? 'right' : 'left',
      wrapText: false,
      indent: numeric.has(colNumber) ? 0 : 1,
    }
    cell.border = {
      top: { style: 'thin', color: { argb: BRAND.headerText } },
      bottom: { style: 'medium', color: { argb: BRAND.orange } },
    }
  })
}

/**
 * Aplica el acabado profesional a las filas de datos de una worksheet:
 * fuente consistente, zebra striping, bordes hairline y alineación por tipo
 * de columna (los formatos numéricos se respetan desde `ws.columns`).
 *
 * Reaplica también la alineación del encabezado (fila 1) usando las mismas
 * columnas numéricas, de modo que header y datos queden siempre cuadrados.
 *
 * @param ws            worksheet ya poblada (encabezado en fila 1)
 * @param numericKeys   keys de columnas que deben ir alineadas a la derecha
 * @param lastDataRow   última fila de datos (sin contar TOTAL); por defecto rowCount
 * @param colorKeys     mapa key→ARGB para teñir el valor de ciertas columnas
 *                      (ej. USDT en verde, como en las tablas de la UI). Si el
 *                      ARGB es `'signed'` el color depende del signo del número.
 */
export const finishTable = (
  ws: ExcelJS.Worksheet,
  numericKeys: string[] = [],
  lastDataRow?: number,
  colorKeys: Record<string, string> = {},
): void => {
  const end = lastDataRow ?? ws.rowCount
  const numericCols = resolveNumericCols(ws, numericKeys)
  // Resuelve número de columna → color objetivo.
  const colorByCol = new Map<number, string>()
  ws.columns.forEach((c, i) => {
    if (c.key && colorKeys[c.key]) colorByCol.set(i + 1, colorKeys[c.key]!)
  })

  // Mantiene el encabezado alineado igual que sus datos (números a la
  // derecha, resto a la izquierda) y en una sola línea (sin wrap), tras
  // garantizar el ancho mínimo para el título.
  fitHeaderWidths(ws)
  ws.getRow(1).eachCell((cell, colNumber) => {
    cell.alignment = {
      vertical: 'middle',
      horizontal: numericCols.has(colNumber) ? 'right' : 'left',
      wrapText: false,
      indent: numericCols.has(colNumber) ? 0 : 1,
    }
  })

  for (let r = 2; r <= end; r += 1) {
    const row = ws.getRow(r)
    const zebra = r % 2 === 0
    row.height = 20
    row.eachCell((cell, colNumber) => {
      const colorSpec = colorByCol.get(colNumber)
      let argb: string = BRAND.ink
      if (colorSpec === 'signed') {
        const n = typeof cell.value === 'number' ? cell.value : Number(cell.value)
        argb = Number.isFinite(n) && n < 0 ? BRAND.danger : BRAND.success
      } else if (colorSpec) {
        argb = colorSpec
      }
      cell.font = {
        name: FONT,
        size: 10.5,
        bold: colorSpec !== undefined,
        color: { argb },
      }
      if (zebra) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: BRAND.rowAlt },
        }
      }
      cell.border = {
        bottom: { style: 'thin', color: { argb: BRAND.border } },
      }
      cell.alignment = {
        vertical: 'middle',
        horizontal: numericCols.has(colNumber) ? 'right' : 'left',
        indent: numericCols.has(colNumber) ? 0 : 1,
      }
    })
  }
}

/** Estiliza la fila TOTAL: negrita, relleno de marca y borde superior fuerte. */
export const styleTotalRow = (row: ExcelJS.Row): void => {
  row.height = 22
  row.eachCell((cell) => {
    cell.font = { name: FONT, bold: true, size: 11, color: { argb: BRAND.ink } }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: BRAND.totalFill },
    }
    cell.border = {
      top: { style: 'medium', color: { argb: BRAND.orange } },
      bottom: { style: 'medium', color: { argb: BRAND.orange } },
    }
  })
}

/**
 * Inserta una hoja de portada de marca como primera pestaña, con metadatos
 * del reporte. No interfiere con las hojas que tienen asserts porque se
 * agrega aparte (la prueba valida el orden esperado por hoja).
 */
export const applyWorkbookMeta = (wb: ExcelJS.Workbook): void => {
  wb.creator = 'BanexReintegra'
  wb.company = 'Banexcoin Bolivia'
  wb.created = new Date()
}

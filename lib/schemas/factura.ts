import { z } from 'zod'

/**
 * Schema Zod para validar cambios en factura
 *
 * Valida tipos, rangos, formatos al recibir el JSON del cliente.
 * Rechaza campos que no sean editables.
 *
 * CAMPOS EDITABLES (11):
 * - numero_factura (string)
 * - fecha_emision (date ISO 8601)
 * - fecha_vencimiento (date ISO 8601 | null)
 * - importe_base (number ≥ 0)
 * - importe_iva (number ≥ 0)
 * - importe_total (number > 0)
 * - tipo_iva (string)
 * - concepto (string)
 * - moneda (ISO 4217, 3 caracteres)
 * - iban (IBAN válido | null)
 * - proveedor_id (UUID | null)
 *
 * NUNCA permitir editar (validado con .strict()):
 * - id
 * - drive_file_id
 * - hash_pdf
 * - created_at
 * - updated_at
 * - estado_lectura
 * - estado_conciliacion
 * - estado_gestor
 * - estado_revision
 * - revisado_por
 * - revisado_en
 */

// Validar fecha ISO 8601
const fechaISO = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha debe ser formato ISO 8601 (YYYY-MM-DD)')
  .refine((d) => !isNaN(Date.parse(d)), 'Fecha inválida')

// Validar UUID v4
const uuidSchema = z
  .string()
  .uuid('UUID inválido')

// Validar IBAN (básico)
const ibanSchema = z
  .string()
  .regex(/^[A-Z]{2}\d{2}[A-Z0-9]{1,30}$/, 'IBAN inválido')
  .nullable()
  .optional()

// Validar ISO 4217 currency code (3 caracteres, mayúsculas)
const currencySchema = z
  .string()
  .length(3, 'Moneda debe ser código ISO 4217 (3 caracteres)')
  .regex(/^[A-Z]{3}$/, 'Moneda debe ser 3 letras mayúsculas (ej: EUR)')

export const ActualizarFacturaSchema = z
  .object({
    numero_factura: z
      .string()
      .min(1, 'numero_factura no puede estar vacío')
      .max(50, 'numero_factura máximo 50 caracteres')
      .optional(),

    fecha_emision: fechaISO.optional(),

    fecha_vencimiento: fechaISO.nullable().optional(),

    importe_base: z
      .number({ message: 'importe_base debe ser número' })
      .nonnegative('importe_base no puede ser negativo')
      .optional(),

    importe_iva: z
      .number({ message: 'importe_iva debe ser número' })
      .nonnegative('importe_iva no puede ser negativo')
      .optional(),

    importe_total: z
      .number({ message: 'importe_total debe ser número' })
      .positive('importe_total debe ser positivo')
      .optional(),

    tipo_iva: z
      .string()
      .max(10, 'tipo_iva máximo 10 caracteres')
      .optional(),

    concepto: z
      .string()
      .max(500, 'concepto máximo 500 caracteres')
      .optional(),

    moneda: currencySchema.optional(),

    iban: ibanSchema,

    proveedor_id: uuidSchema.nullable().optional(),

    // Campo de concurrencia optimista (se envía desde cliente)
    expected_updated_at: z
      .string()
      .datetime('expected_updated_at debe ser timestamp ISO 8601'),
  })
  .strict() // Rechaza campos no conocidos
  .refine(
    (data) => Object.keys(data).some((key) => key !== 'expected_updated_at'),
    'Debe proporcionar al menos un campo para editar (además de expected_updated_at)'
  )

export type ActualizarFacturaInput = z.infer<typeof ActualizarFacturaSchema>

/**
 * Validar y separar cambios del control de concurrencia
 *
 * Retorna:
 * - cambios: JSONB con solo los campos editables
 * - expected_updated_at: timestamp para verificar concurrencia
 */
export function parsearActualizacion(
  input: ActualizarFacturaInput
): { cambios: Record<string, unknown>; expected_updated_at: string } {
  const { expected_updated_at, ...cambios } = input

  // Remover undefined (Zod no los incluye si son optional y no enviados)
  const cambiosLimpiados: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(cambios)) {
    if (value !== undefined) {
      cambiosLimpiados[key] = value
    }
  }

  return {
    cambios: cambiosLimpiados,
    expected_updated_at,
  }
}

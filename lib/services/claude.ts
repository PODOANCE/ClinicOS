import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

/**
 * Extrae texto de un PDF usando pdf-parse (API v2: clase PDFParse, no la
 * función callable de v1). Si no hay texto suficiente, retorna null (indica
 * que es un escaneo/imagen y requiere revisión manual). Un fallo real de
 * lectura se propaga como excepción: nunca se sustituye por datos de
 * prueba, para no confundir un PDF ilegible con un PDF leído correctamente.
 */
export async function extraerTextoDelPdf(pdfBuffer: Buffer): Promise<string | null> {
  const { PDFParse } = require('pdf-parse')
  const parser = new PDFParse({ data: pdfBuffer })
  try {
    const resultado = await parser.getText()
    const texto = resultado.text.trim()

    // Si el PDF tiene muy poco texto, probablemente sea un escaneo
    if (texto.length < 100) {
      return null
    }

    return texto
  } finally {
    if (typeof parser.destroy === 'function') await parser.destroy()
  }
}

/**
 * Extrae datos estructurados de texto de factura usando Claude
 * Retorna JSON bruto sin procesamiento posterior
 *
 * Entrada: texto extraído del PDF
 * Salida: JSON con datos estructurados
 * La IA interpreta; nuestro código valida
 *
 * MOCK para testing sin créditos de API
 */
export async function extraerDatosFacturaConClaude(
  textoFactura: string
): Promise<{
  numero_factura?: string
  fecha_emision?: string
  fecha_vencimiento?: string
  nif_cif_proveedor?: string
  nombre_proveedor?: string
  base_imponible?: number
  iva?: number
  total?: number
  tipo_iva?: string
  concepto?: string
  moneda?: string
  iban?: string
  [key: string]: unknown
}> {
  // MOCK: Simular respuesta de Claude para testing
  // TODO: Reemplazar con llamada real a Claude cuando se tenga API key con créditos
  const apiKey = process.env.ANTHROPIC_API_KEY || ''
  const isMock = process.env.CLAUDE_MOCK === 'true' || !apiKey || apiKey.includes('<') || apiKey === 'sk_...'

  if (isMock) {
    console.log('[MOCK] Extrayendo datos de factura (modo test)')

    return {
      numero_factura: 'FAC-2026-001234',
      fecha_emision: '2026-08-29',
      fecha_vencimiento: '2026-09-28',
      nif_cif_proveedor: 'A12345678',
      nombre_proveedor: 'Proveedor Test S.L.',
      base_imponible: 1000.0,
      iva: 210.0,
      total: 1210.0,
      tipo_iva: '21',
      concepto: 'Servicios profesionales',
      moneda: 'EUR',
    }
  }

  // Llamada real a Claude (cuando tenga créditos)
  const message = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Extrae los datos de esta factura en formato JSON estructurado.
Devuelve SOLO JSON válido, sin explicaciones.

FACTURA:
---
${textoFactura}
---

Campos a extraer (si existen):
- numero_factura: número de factura
- fecha_emision: fecha YYYY-MM-DD
- fecha_vencimiento: fecha YYYY-MM-DD
- nif_cif_proveedor: NIF/CIF del proveedor
- nombre_proveedor: razón social
- base_imponible: base imponible en EUR
- iva: IVA en EUR
- total: total en EUR
- tipo_iva: porcentaje de IVA (21, 10, 4, 0, etc)
- concepto: descripción de líneas
- moneda: EUR, USD, etc
- iban: IBAN si aparece

Formato esperado:
{
  "numero_factura": "...",
  "fecha_emision": "2026-08-29",
  "base_imponible": 100.00,
  "iva": 21.00,
  "total": 121.00,
  ...
}

Si un campo no está presente, omítelo del JSON.`,
      },
    ],
  })

  // Extraer el contenido de texto
  const textContent = message.content.find((block) => block.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    throw new Error('Claude no devolvió texto')
  }

  // Parsear JSON
  try {
    const datos = JSON.parse(textContent.text)
    return datos
  } catch (error) {
    throw new Error(
      `Claude devolvió JSON inválido: ${textContent.text.substring(0, 200)}`
    )
  }
}

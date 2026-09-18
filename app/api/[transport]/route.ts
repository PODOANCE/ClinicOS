/**
 * Servidor MCP (Model Context Protocol) de ClinicOS.
 *
 * Esto es lo que se añade como "Conector" en la cuenta de Claude del
 * usuario (Ajustes → Conectores → Añadir conector personalizado), con la
 * URL pública de esta ruta y la clave SKILL_API_KEY como cabecera
 * Authorization. Una Skill normal (solo instrucciones) no puede hacer
 * llamadas de red por sí misma — por eso hace falta este servidor MCP,
 * que sí las expone como herramientas reales que Claude puede invocar.
 *
 * Las 5 herramientas son un espejo 1:1 de los endpoints REST bajo
 * /api/skill/* (misma lógica, en lib/services/skill-tools.ts) — se
 * mantienen ambos porque los endpoints REST siguen siendo útiles para
 * pruebas manuales (curl) y no todo cliente MCP es igual de cómodo para
 * eso.
 */

import { createMcpHandler, withMcpAuth } from 'mcp-handler'
import { z } from 'zod'
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js'
import {
  obtenerEstadoGlobal,
  obtenerPropuestasPendientes,
  ejecutarConciliacionGlobal,
  obtenerTextoFactura,
  guardarLecturaFactura,
  SkillToolError,
} from '@/lib/services/skill-tools'

function contenidoJson(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] }
}

function contenidoError(err: unknown) {
  const mensaje =
    err instanceof SkillToolError
      ? { error: err.message, code: err.code }
      : { error: err instanceof Error ? err.message : 'Error desconocido', code: 'INTERNAL_ERROR' }
  return { content: [{ type: 'text' as const, text: JSON.stringify(mensaje) }], isError: true }
}

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      'clinicos_estado',
      {
        title: 'Estado global de Facturas y Conciliación',
        description:
          'Da la foto completa de ClinicOS: todas las facturas y movimientos bancarios, con sus estados de lectura, conciliación y envío a gestoría. Úsalo primero, antes de leer o conciliar nada.',
        inputSchema: {},
      },
      async () => {
        try {
          return contenidoJson(await obtenerEstadoGlobal())
        } catch (err) {
          return contenidoError(err)
        }
      }
    )

    server.registerTool(
      'clinicos_propuestas_conciliacion',
      {
        title: 'Propuestas de conciliación pendientes',
        description:
          'Lista las coincidencias factura↔movimiento que el motor determinista ya ha encontrado y están pendientes de que un humano las acepte o rechace dentro de ClinicOS.',
        inputSchema: {},
      },
      async () => {
        try {
          return contenidoJson(await obtenerPropuestasPendientes())
        } catch (err) {
          return contenidoError(err)
        }
      }
    )

    server.registerTool(
      'clinicos_ejecutar_conciliacion',
      {
        title: 'Ejecutar el cruce de facturas y movimientos',
        description:
          'Dispara el motor determinista de conciliación sobre todas las facturas y movimientos pendientes. Solo genera propuestas nuevas; no acepta ni rechaza nada por su cuenta.',
        inputSchema: {},
      },
      async () => {
        try {
          return contenidoJson(await ejecutarConciliacionGlobal())
        } catch (err) {
          return contenidoError(err)
        }
      }
    )

    server.registerTool(
      'clinicos_leer_texto_factura',
      {
        title: 'Leer el texto de una factura',
        description:
          'Descarga el PDF de una factura desde Drive y devuelve su texto plano, para que tú (Claude) lo leas y extraigas los datos. No hace ninguna extracción por su cuenta.',
        inputSchema: {
          facturaId: z.string().describe('El id de la factura en ClinicOS (columna facturas.id)'),
        },
      },
      async ({ facturaId }) => {
        try {
          return contenidoJson(await obtenerTextoFactura(facturaId))
        } catch (err) {
          return contenidoError(err)
        }
      }
    )

    server.registerTool(
      'clinicos_guardar_lectura_factura',
      {
        title: 'Guardar la lectura de una factura',
        description:
          'Guarda en ClinicOS los datos que tú (Claude) has extraído leyendo el texto de una factura. Solo envía los campos que realmente hayas encontrado; nunca inventes un valor.',
        inputSchema: {
          facturaId: z.string().describe('El id de la factura en ClinicOS (columna facturas.id)'),
          numero_factura: z.string().optional(),
          fecha_emision: z.string().optional().describe('Formato YYYY-MM-DD'),
          fecha_vencimiento: z.string().optional().describe('Formato YYYY-MM-DD'),
          nif_cif_proveedor: z.string().optional(),
          nombre_proveedor: z.string().optional(),
          base_imponible: z.number().optional(),
          iva: z.number().optional(),
          total: z.number().optional(),
          tipo_iva: z.string().optional(),
          concepto: z.string().optional(),
          moneda: z.string().optional(),
          iban: z.string().optional(),
        },
      },
      async ({ facturaId, ...datos }) => {
        try {
          return contenidoJson(await guardarLecturaFactura(facturaId, datos))
        } catch (err) {
          return contenidoError(err)
        }
      }
    )
  },
  {},
  { basePath: '/api', verboseLogs: false }
)

async function verificarToken(_req: Request, bearerToken?: string): Promise<AuthInfo | undefined> {
  const esperado = process.env.SKILL_API_KEY
  if (!esperado || !bearerToken || bearerToken !== esperado) return undefined
  return { token: bearerToken, clientId: 'clinicos-skill', scopes: [] }
}

const handlerConAuth = withMcpAuth(handler, verificarToken, { required: true })

export { handlerConAuth as GET, handlerConAuth as POST }

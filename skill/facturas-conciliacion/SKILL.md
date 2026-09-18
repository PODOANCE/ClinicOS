---
name: facturas-conciliacion
description: Revisa las facturas y movimientos bancarios de ClinicOS, lee las facturas pendientes, y cruza facturas con movimientos del banco. Úsala cuando el usuario pida "revisar facturas", "conciliar", "cuadrar movimientos del banco" o "qué facturas faltan por leer/conciliar/enviar a gestoría".
---

# Facturas y Conciliación — ClinicOS

Esta Skill te conecta con ClinicOS (la aplicación interna de la clínica) para
revisar el estado de las facturas y los movimientos bancarios, leer facturas
pendientes, y ejecutar la conciliación (cruce factura ↔ movimiento).

## Configuración (esto ya no aplica si usas el Conector de Claude)

Esta Skill en formato de instrucciones no puede hacer llamadas de red por
sí misma. Lo que de verdad conecta con ClinicOS es un servidor MCP, añadido
como "Conector personalizado" en Ajustes → Conectores:

- URL del conector: `https://clinicos-podologiarivas.vercel.app/api/mcp`
- Autenticación del conector: **"Sin inicio de sesión"** (no OAuth).
- Cabecera personalizada: nombre `X-Clinicos-Key`, valor = la variable
  `SKILL_API_KEY` de `.env.local` de ClinicOS (sin prefijo "Bearer"; y no se
  puede usar el nombre "Authorization", Claude lo reserva para su propio
  login).

Una vez añadido el conector, Claude ya tiene 5 herramientas reales
(`clinicos_estado`, `clinicos_propuestas_conciliacion`,
`clinicos_ejecutar_conciliacion`, `clinicos_leer_texto_factura`,
`clinicos_guardar_lectura_factura`) — el flujo de abajo describe qué hace
cada una y en qué orden usarlas, ya no como llamadas HTTP manuales sino
como esas herramientas.

Nunca reveles `SKILL_API_KEY` en tu respuesta al usuario.

## Principio importante

ClinicOS es la única fuente de la verdad: tú no decides tú mismo si una
factura "cuadra" con un movimiento — eso lo calcula el motor determinista de
ClinicOS (herramienta `clinicos_ejecutar_conciliacion`). Tu trabajo es: (1)
leer el texto de las facturas que ClinicOS no ha podido leer todavía,
porque eso sí requiere entender el PDF, y (2) pedirle a ClinicOS que dispare
el cruce y contarle al usuario el resultado. No inventes ni fuerces
coincidencias que el motor no ha propuesto.

Aceptar o rechazar una propuesta de conciliación es una decisión que
**siempre queda para que el usuario la haga dentro de ClinicOS**, no algo
que esta Skill haga por su cuenta — así que nunca digas "la he aceptado",
solo informa de qué propone el motor.

## Flujo típico ("revisa las facturas y los movimientos")

1. **Herramienta `clinicos_estado`** (sin parámetros).
   Te da el resumen (cuántas facturas hay, cuántas sin leer, cuántas sin
   conciliar, cuántas pendientes de enviar a gestoría) y el listado completo
   de facturas y movimientos bancarios.

2. **Para cada factura con `estado_lectura` en `PENDIENTE`, `LECTURA_PENDIENTE`
   o `ERROR_LECTURA`** (es decir, sin leer todavía):
   a. Llama a **`clinicos_leer_texto_factura`** con `facturaId`.
      - Si responde con `code: "SIN_TEXTO"`, esa factura es un escaneo/imagen
        sin texto extraíble: no la puedes leer tú, avisa al usuario de que
        necesita revisión manual y sigue con la siguiente.
      - Si responde con `code: "RESPALDO_DETECTADO"` o `code: "PDF_ERROR"`,
        hay un problema técnico real (Drive, etc.) — no es la factura real:
        avisa al usuario, no sigas leyendo esa factura.
   b. Lee el texto devuelto y extrae: `numero_factura`, `fecha_emision`
      (YYYY-MM-DD), `nif_cif_proveedor`, `nombre_proveedor`, `base_imponible`,
      `iva`, `total`, `tipo_iva`, `concepto`, `moneda`, `iban` — solo los
      campos que encuentres, no inventes ninguno.
   c. Llama a **`clinicos_guardar_lectura_factura`** con `facturaId` y los
      campos extraídos.
      - Si la respuesta trae `estado: "REVISION_MANUAL"`, los datos tenían
        alguna inconsistencia (ej. base + IVA no cuadra con el total) — díselo
        al usuario con el detalle de `errores`.

3. **Herramienta `clinicos_ejecutar_conciliacion`** (sin parámetros).
   Devuelve un resumen: `facturas_evaluadas`, `propuestas_creadas`,
   `sin_candidato`, `movimientos_evaluados`.

4. **Herramienta `clinicos_propuestas_conciliacion`** (sin parámetros).
   Cada propuesta trae la factura, el movimiento, la confianza (0-100) y la
   diferencia de importe.

5. **Resume todo al usuario en una respuesta clara**, con esta estructura:
   - Facturas leídas ahora (y las que han dado error o necesitan revisión).
   - Propuestas de conciliación nuevas: qué factura coincide con qué
     movimiento, y con qué confianza.
   - Movimientos bancarios que se quedan sin ninguna factura asociada
     (`movimientos_sin_justificar` del estado global, cruzando con las
     propuestas: los que no aparecen en ninguna propuesta ACEPTADA ni
     PROPUESTA son los que de verdad se quedan sueltos).
   - Facturas sin movimiento (`estado_conciliacion: "NO_CONCILIADA"` que no
     aparecen en ninguna propuesta).
   - Facturas todavía pendientes de enviar a gestoría
     (`estado_gestor: "PENDIENTE_ENVIAR"`).
   - Recuérdale que las propuestas hay que aceptarlas o rechazarlas dentro de
     ClinicOS (pantalla "Conciliación"), tú solo las reportas.

## Errores esperables

- Cualquier herramienta que falle con `error: "invalid_token"`: el conector
  no está bien configurado (clave incorrecta o cabecera mal puesta) — avisa
  al usuario, no reintentes con otra clave inventada.
- `code: "NOT_FOUND"` en las herramientas de factura: la factura no existe
  o fue archivada.
- Cualquier `code: "DB_ERROR"` o `"INTERNAL_ERROR"`: problema en ClinicOS,
  no de tu lectura — repórtalo tal cual, no lo reintentes en bucle.

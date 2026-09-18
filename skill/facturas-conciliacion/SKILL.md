---
name: facturas-conciliacion
description: Revisa las facturas y movimientos bancarios de ClinicOS, lee las facturas pendientes, y cruza facturas con movimientos del banco. Úsala cuando el usuario pida "revisar facturas", "conciliar", "cuadrar movimientos del banco" o "qué facturas faltan por leer/conciliar/enviar a gestoría".
---

# Facturas y Conciliación — ClinicOS

Esta Skill te conecta con ClinicOS (la aplicación interna de la clínica) para
revisar el estado de las facturas y los movimientos bancarios, leer facturas
pendientes, y ejecutar la conciliación (cruce factura ↔ movimiento).

## Configuración (rellenar antes de usar)

- `BASE_URL`: `https://clinicos-podologiarivas.vercel.app` — ya desplegada.
  Cuando dentro de unos días quede activo `app.podologiarivas.com`, cambia
  esta URL por esa (misma app, solo cambia el dominio).
- `SKILL_API_KEY`: la clave técnica de `.env.local` de ClinicOS (variable
  `SKILL_API_KEY`). Va en la cabecera `Authorization: Bearer <SKILL_API_KEY>`
  de cada llamada.

Nunca reveles `SKILL_API_KEY` en tu respuesta al usuario ni la escribas en
ningún sitio fuera de la cabecera de la petición.

## Principio importante

ClinicOS es la única fuente de la verdad: tú no decides tú mismo si una
factura "cuadra" con un movimiento — eso lo calcula el motor determinista de
ClinicOS (`/api/skill/conciliacion/ejecutar`). Tu trabajo es: (1) leer el
texto de las facturas que ClinicOS no ha podido leer todavía, porque eso sí
requiere entender el PDF, y (2) pedirle a ClinicOS que dispare el cruce y
contarle al usuario el resultado. No inventes ni fuerces coincidencias que
el motor no ha propuesto.

Aceptar o rechazar una propuesta de conciliación es una decisión que
**siempre queda para que el usuario la haga dentro de ClinicOS**, no algo
que esta Skill haga por su cuenta — así que nunca digas "la he aceptado",
solo informa de qué propone el motor.

## Flujo típico ("revisa las facturas y los movimientos")

1. **Pide el estado global**:
   `GET {BASE_URL}/api/skill/estado`
   Te da el resumen (cuántas facturas hay, cuántas sin leer, cuántas sin
   conciliar, cuántas pendientes de enviar a gestoría) y el listado completo
   de facturas y movimientos bancarios.

2. **Para cada factura con `estado_lectura` en `PENDIENTE`, `LECTURA_PENDIENTE`
   o `ERROR_LECTURA`** (es decir, sin leer todavía):
   a. Pide su texto: `GET {BASE_URL}/api/skill/facturas/{id}/texto`
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
   c. Guarda lo que has leído:
      `POST {BASE_URL}/api/skill/facturas/{id}/lectura`
      con el JSON de los campos extraídos en el body.
      - Si la respuesta trae `estado: "REVISION_MANUAL"`, los datos tenían
        alguna inconsistencia (ej. base + IVA no cuadra con el total) — díselo
        al usuario con el detalle de `errores`.

3. **Ejecuta el cruce**:
   `POST {BASE_URL}/api/skill/conciliacion/ejecutar`
   Devuelve un resumen: `facturas_evaluadas`, `propuestas_creadas`,
   `sin_candidato`, `movimientos_evaluados`.

4. **Consulta las propuestas pendientes de revisar**:
   `GET {BASE_URL}/api/skill/conciliacion/propuestas`
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

- `401` en cualquier endpoint: la `SKILL_API_KEY` es incorrecta o falta —
  avisa al usuario, no reintentes con otra clave inventada.
- `404` en `/facturas/{id}/...`: la factura no existe o fue archivada.
- Cualquier `code: "DB_ERROR"` o `"INTERNAL_ERROR"`: problema en ClinicOS,
  no de tu lectura — repórtalo tal cual, no lo reintentes en bucle.

# HANDOFF DE DESARROLLO · ÁREA DE FACTURAS

*Documento práctico para empezar a construir. No repite la especificación ni el diseño funcional (ver FACTURAS-especificacion-funcional.md y FACTURAS-diseno-funcional.md para el detalle). Se construye siguiendo la arquitectura común (00–07) y el contrato de Área. Enfoque iterativo: construir, validar, ajustar.*

---

## 1. Objetivo del Área

Justificar toda la actividad económica de la empresa. Cada movimiento bancario debe quedar justificado (con factura o con explicación) y cada factura debe encontrar su lugar. La IA hace un único análisis completo de cada factura, del que derivan todos los resultados: extracción, conciliación, categorización, estadística y alimentación del Panel 360. La IA nunca inventa: ante la duda, genera incidencia.

## 2. Flujo principal resumido

1. Entra una factura (origen indiferente) y/o se aportan movimientos bancarios.
2. La IA interpreta cada factura una vez: la comprende, extrae su información estructurada con nivel de confianza, y clasifica el gasto.
3. El motor concilia facturas con movimientos pendientes (incremental, sin asumir uno-a-uno, sin inventar).
4. Lo conciliado pasa a preparado para gestoría. Una persona lo sube al portal externo.
5. Todo lo que la IA no puede cerrar con confianza se convierte en incidencia para revisión humana.

## 3. Entidades que intervienen

- **Factura** — documento recibido, con información estructurada y clasificación de gasto.
- **Movimiento bancario** — pago/cobro real a justificar (objeto común nuevo).
- **Proveedor** — a quién corresponde la factura (ya existe).
- **Categoría de gasto** — clasificación económica (objeto compartido con Panel 360).
- **Documento** — el archivo original de la factura (ya existe).
- **Conciliación** — relación entre factura(s) y movimiento(s); cardinalidad flexible (1-1, 1-N, N-1, N-N).
- **Incidencia** — caso que requiere atención humana (objeto o estado, se decide al construir).
- **Regla de categorización** — patrón aprendido concepto → categoría.
- **Tarea** — trabajo generado por incidencias, aparece en Hoy (ya existe).

## 4. Estados

**Factura:** pendiente de procesar → interpretada → (en incidencia) → conciliada → preparada para gestoría → enviada a gestoría → archivada.

**Movimiento bancario:** pendiente de justificar → conciliado / justificado sin factura → (en incidencia) → archivado.

**Incidencia:** abierta → resuelta / descartada.

## 5. Procesos automáticos de IA

- Detectar facturas nuevas disponibles.
- Interpretar cada factura una sola vez (comprensión completa + confianza por dato).
- Clasificar el gasto en una o varias categorías, aplicando reglas aprendidas.
- Conciliar facturas con movimientos pendientes (incremental).
- Detectar duplicados.
- Generar incidencias cuando la confianza no basta.
- Aprender de las correcciones de categoría del usuario.

Regla: un único análisis por factura alimenta todos los procesos; no se reprocesa.

## 6. Acciones del usuario

- Aportar movimientos bancarios.
- Consultar el estado de justificación general.
- Revisar detalle de factura o movimiento.
- Corregir información extraída con baja confianza.
- Validar una conciliación dudosa.
- Explicar un movimiento como "justificado sin factura".
- Resolver o descartar una incidencia.
- Asignar/corregir categoría (enseña al sistema).
- Preparar y marcar facturas como enviadas a gestoría.
- Consultar gasto por categoría (según permiso).

Permisos: Administración es el rol operativo; Administrador del sistema, acceso completo; Podólogo/Ortopedia, sin acceso. La vista de gasto por categoría puede requerir permiso restringido.

## 7. Incidencias

Catálogo: no es factura · no se pudo interpretar · factura sin movimiento · movimiento sin factura · varias conciliaciones posibles · posible duplicado · documento ilegible · otros sin confianza.

Principio: ninguna incidencia se cierra por suposición de la IA. Se cierra cuando hay justificación suficiente, automática o validada por una persona. El estado final es "queda justificado/explicado y deja de requerir intervención", no necesariamente "aparece una factura".

## 8. Integraciones necesarias

- **Panel 360** — el Área es la fuente de verdad económica; el Panel consume el gasto clasificado a través de objetos comunes (Movimiento, Categoría, Factura), nunca por dependencia directa entre Áreas.
- **IA** — capacidad transversal que el Área consume para leer, extraer, clasificar, conciliar y generar incidencias.
- **Futuras (sin cambiar la lógica):** correo (buzón de facturas), banca online (movimientos automáticos), portales de proveedores, envío automático a gestoría. Todas desembocan en los mismos hechos: "factura disponible" y "movimientos disponibles".

## 9. Funcionalidades heredadas de la herramienta actual (trasladar y mejorar)

- Registro de movimientos y detección de duplicados por huella (fecha + importe + concepto).
- Estados de justificación (sin justificar → conseguida → subida a gestoría).
- Clasificación de gasto por categorías.
- Aprendizaje de reglas de categorización a partir de las decisiones del usuario.
- Panel "¿está todo justificado?".
- Vista de gasto por categoría con comparación entre periodos.
- Trazabilidad: quién marcó cada cosa y cuándo.

## 10. Funcionalidades nuevas que hay que desarrollar

- Entrada de facturas como documento (PDF u otros), origen indiferente.
- Lectura e interpretación de facturas por IA, con extracción estructurada y confianza por dato.
- Motor de conciliación automática factura ↔ movimiento (cardinalidad flexible).
- Generación automática de incidencias.
- Clasificación automática del gasto derivada del análisis de IA.
- Análisis único que alimenta todos los resultados.

## 11. Criterios de aceptación (Área terminada)

- Una factura disponible se interpreta automáticamente y queda con su información estructurada y su categoría, sin intervención en el caso normal.
- Se pueden aportar movimientos bancarios y el sistema ignora duplicados.
- El motor concilia automáticamente lo que puede, de forma incremental, y deja las tres salidas visibles (conciliados, facturas sin movimiento, movimientos sin factura).
- Todo lo que la IA no puede cerrar con confianza aparece como incidencia, sin datos inventados.
- Una persona puede resolver cada tipo de incidencia hasta dejar el movimiento/factura justificado.
- El gasto queda clasificado por categoría y esa información está disponible para el Panel 360.
- Las correcciones de categoría del usuario se aprenden y se aplican en el futuro.
- Lo conciliado se agrupa como "preparado para gestoría" y puede marcarse como enviado.
- El panel de justificación refleja en todo momento qué queda sin justificar.
- Los permisos por rol se respetan (Administración opera; Podólogo/Ortopedia no ven el Área).
- Ninguna funcionalidad heredada de la herramienta anterior se pierde.

---

*Handoff listo para desarrollo. Los huecos menores se resuelven de forma iterativa durante la construcción.*

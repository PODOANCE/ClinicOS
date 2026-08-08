# DISEÑO FUNCIONAL · ÁREA DE FACTURAS

*Puente entre la especificación funcional (el negocio) y la implementación. Describe qué necesita el Área y cómo se comporta dentro de la plataforma, sin decisiones técnicas ni código. Su primera sección aísla lo que el Área solicita a la arquitectura común; el resto es diseño propio del Área.*

*Entrada para: la fase de CTO (actualización de 03–07 y DECISIONS) y, después, Claude Code.*

---

## 0. Impacto sobre la arquitectura común

Lo que el Área de Facturas necesita de la arquitectura general. El Área **no resuelve** estas necesidades: las declara para que se decidan en los documentos comunes (03–07) y se registren en DECISIONS. Las cuatro primeras están aprobadas por el Product Owner.

**0.1 Nuevo objeto global: Movimiento bancario.** (Aprobada.)
Un movimiento económico de la empresa, con identidad, ciclo de vida y estados propios. No pertenece en exclusiva al Área de Facturas: es un objeto común del modelo (03), porque otras funcionalidades económicas (Panel 360, futuras Áreas) lo usarán. El Área de Facturas lo consume y lo hace avanzar, pero no es su dueña.

**0.2 Nuevo objeto compartido: Categoría de gasto.** (Aprobada.)
Una clasificación económica del gasto. Existe una única definición de categorías en toda la plataforma (principio 6: los objetos existen una sola vez). La usan Facturas y el Panel 360, y cualquier funcionalidad económica futura. No vive dentro del Área de Facturas.

**0.3 Relación Factura ↔ Movimiento bancario no uno-a-uno.** (Aprobada.)
La arquitectura debe poder representar relaciones uno-a-uno, uno-a-muchos, muchos-a-uno y, si hiciera falta, muchos-a-muchos entre facturas y movimientos. La conciliación es esa relación. Cómo se modela es decisión de 03; que deba existir con esa cardinalidad es funcional.

**0.4 Excepción a la decisión 047 para el Área de Facturas.** (Aprobada.)
La automatización mediante IA (lectura documental, comprensión y conciliación) es parte esencial de la v1 de esta Área, no una mejora futura. La decisión 047 se excepciona solo para Facturas. A registrar en DECISIONS y reflejar en 05/07.

**0.5 Otras necesidades detectadas hacia la arquitectura** (no decididas, se señalan):
- **Relación entre Áreas: Facturas → Panel 360.** El Área de Facturas alimenta el Panel 360 con información económica clasificada. La frontera y el flujo entre ambas Áreas es decisión común (05). Recordatorio: las Áreas no dependen entre sí (principio 5.5 de arquitectura); comparten objetos, no lógica. Facturas y Panel 360 deben comunicarse a través de objetos comunes (Movimiento, Categoría, Factura), no llamándose entre sí.
- **La IA como capacidad transversal.** El Área necesita capacidades de IA (leer documentos, extraer, clasificar, conciliar, generar incidencias). Coherente con el principio 4 (la IA es transversal). Cómo se ofrece esa capacidad a las Áreas es decisión común, no del Área.
- **Almacenamiento de documentos.** Las facturas son documentos (objeto Documento, ya en 03). El Área lo reutiliza; no crea su propio almacenamiento.
- **Contrato de la Tarea.** Las incidencias del Área generan tareas para el Hoy de una persona, según el contrato de la Tarea ya fijado en 03. El Área lo respeta, no lo redefine.

*Todo lo que sigue es diseño propio del Área y no requiere aprobación de arquitectura, salvo donde se remita a esta sección.*

---

## 1. Entidades del Área

Las cosas que el Área maneja. Se distingue entre objetos comunes (viven en el modelo general) y su uso dentro del Área.

**Objetos comunes que el Área usa:**
- **Factura** — documento de cobro recibido, con su información estructurada y su clasificación de gasto.
- **Movimiento bancario** — un pago o cobro real de la empresa a justificar. (Nuevo, 0.1.)
- **Proveedor** — a quién corresponde una factura. Ya existe.
- **Categoría de gasto** — clasificación económica. (Compartido, 0.2.)
- **Documento** — el archivo original de la factura (PDF u otros). Ya existe.
- **Tarea** — el trabajo que generan las incidencias. Ya existe.
- **Conciliación** — la relación entre una o varias facturas y uno o varios movimientos, con la constancia de cómo se estableció (automática o validada por una persona). Su forma exacta la decide 03 (0.3).
- **Incidencia** — un caso que la IA no puede resolver con confianza y que requiere atención humana. *(A decidir en la fase de CTO si es un objeto propio o un estado; el Área solo necesita que exista el concepto.)*
- **Regla de categorización** — el patrón aprendido que asocia un tipo de concepto con una categoría de gasto. Soporta el aprendizaje.

## 2. Estados del ciclo de vida

Los estados funcionales de cada entidad. No son estados técnicos de base de datos; son las situaciones de negocio por las que pasa cada cosa.

**Factura:**
- *Pendiente de procesar* — disponible, aún no interpretada.
- *Interpretada* — la IA la ha comprendido y estructurado (o una persona ha corregido).
- *En incidencia* — no se pudo interpretar o no es una factura; requiere atención humana.
- *Conciliada* — relacionada con su(s) movimiento(s).
- *Preparada para gestoría* — conciliada y agrupada para enviar.
- *Enviada a gestoría* — subida al portal externo.
- *Archivada* — cerrada, se conserva.

**Movimiento bancario:**
- *Pendiente de justificar* — registrado, sin factura ni explicación.
- *Conciliado* — relacionado con su(s) factura(s).
- *Justificado sin factura* — explicado como que no requiere factura (comisión, impuesto, transferencia interna…), validado por una persona.
- *En incidencia* — dudoso; requiere atención humana.
- *Archivado*.

**Incidencia:**
- *Abierta* — pendiente de que una persona la resuelva.
- *Resuelta* — se alcanzó una justificación suficiente; lo afectado vuelve al flujo.
- *Descartada* — se resolvió descartando (no era factura, irrecuperable…).

*(Los estados de la Factura y el Movimiento son de negocio; las transiciones exactas y su representación técnica se deciden al implementar, siguiendo el patrón Estado→Tarea de 05.)*

## 3. Permisos según rol

Coherente con el modelo de permisos (Área + acciones + ámbito) de 04.

- **Administrador del sistema** — acceso completo al Área.
- **Administración** — ver, crear/editar, conciliar (validar conciliaciones dudosas), resolver incidencias, categorizar, preparar y marcar como enviado a gestoría. Es el rol operativo del Área.
- **Podólogo / Ortopedia** — sin acceso al Área de Facturas (coherente con la matriz de 04).
- **Vista de gasto por categoría (Panel 360 / dirección)** — el acceso a la información económica agregada puede requerir un permiso más restringido (en la herramienta anterior estaba tras un PIN de dirección). *A decidir en 04 si se modela como permiso de rol o como ámbito.* El Área lo señala; no lo resuelve.

## 4. Módulos funcionales del Área

Las partes internas del Área, por función. No son pantallas todavía.

- **Entrada** — recibe facturas disponibles y movimientos bancarios aportados. Origen indiferente.
- **Comprensión** — la IA interpreta cada factura una sola vez y genera su representación estructurada, su confianza y su clasificación de gasto.
- **Conciliación** — el motor que relaciona facturas y movimientos pendientes y produce las tres salidas (conciliados, facturas sin movimiento, movimientos sin factura).
- **Incidencias** — recoge todo lo que la IA no puede cerrar con confianza y lo convierte en trabajo humano.
- **Preparación para gestoría** — agrupa lo conciliado del periodo y gestiona el envío manual.
- **Clasificación y aprendizaje** — mantiene las categorías, aplica la clasificación automática y aprende de las correcciones.
- **Información económica** — expone el gasto clasificado para consultas y para alimentar el Panel 360.

## 5. Pantallas necesarias

Las vistas que necesita el Área, respetando la anatomía común de un Área (06: cinco zonas, contrato visual). No es diseño gráfico; es qué pantallas hacen falta y para qué.

- **Panel de justificación** — la vista de entrada: ¿está todo justificado? Qué falta. Es el "Hoy" del Área: lo que requiere atención.
- **Facturas** — lista de facturas con su estado, su detalle e información extraída.
- **Movimientos** — lista de movimientos con su estado de justificación.
- **Conciliación** — vista donde se ven las correspondencias propuestas y las tres salidas del motor; permite validar las dudosas.
- **Incidencias** — lista de incidencias abiertas y su resolución.
- **Para gestoría** — lo conciliado del periodo, listo para subir.
- **Gasto por categoría** — vista económica (posible acceso restringido), con comparación entre periodos. Base del Panel 360.

*Cada pantalla usa los componentes compartidos (tablas, detalle, estados, confirmaciones) de 06; ninguna inventa su propio patrón.*

## 6. Acciones del usuario

Lo que una persona puede hacer, según sus permisos. Todas siguen el flujo único (05) y respetan la confirmación y los estados de 06.

- Aportar movimientos bancarios (hasta que exista integración).
- Consultar el estado de justificación general.
- Revisar el detalle de una factura o un movimiento.
- Corregir la información que la IA extrajo con baja confianza.
- Validar una conciliación dudosa (elegir entre candidatos, confirmar).
- Explicar un movimiento como "justificado sin factura".
- Resolver una incidencia (aportar factura, corregir, descartar…).
- Asignar o corregir la categoría de gasto (enseña al sistema).
- Preparar y marcar facturas como enviadas a gestoría.
- Consultar el gasto por categoría (según permiso).

## 7. Procesos automáticos (IA)

Lo que la IA hace sin intervención humana. Es el "usuario principal" del Área.

- **Detectar** facturas nuevas disponibles.
- **Interpretar** cada factura una sola vez: comprensión completa, representación estructurada, nivel de confianza por dato.
- **Clasificar** el gasto en una o varias categorías, aplicando las reglas aprendidas.
- **Conciliar** facturas con movimientos pendientes, de forma incremental, sin asumir uno-a-uno, sin inventar.
- **Detectar duplicados**.
- **Generar incidencias** cuando la confianza no basta, sin inventar datos ni conciliaciones.
- **Aprender** de las correcciones humanas de categoría.

Principio que gobierna todos: un único análisis por factura alimenta todos estos procesos; no se reprocesa el documento para cada resultado.

## 8. Integración con el Panel 360

- El Área de Facturas es la **fuente de verdad económica**: produce el gasto real, clasificado por categoría, a partir de las facturas y movimientos justificados.
- El Panel 360 **consume** esa información para sus vistas de gasto, en lugar de que alguien la teclee a mano (como ocurría antes).
- La comunicación es **a través de objetos comunes** (Movimiento, Categoría, Factura), nunca por dependencia directa entre Áreas (principio de arquitectura 5.5). El Panel 360 lee los objetos; no llama a la lógica de Facturas.
- La definición de categorías es única y compartida (0.2), de modo que lo que se clasifica en Facturas es exactamente lo que el Panel 360 muestra.

## 9. Integración futura (sin cambiar la lógica funcional)

Estas evoluciones cambian **cómo entra la información**, no cómo se comporta el Área. El diseño debe permitir incorporarlas sin rehacer la lógica.

- **Correo electrónico** — un buzón donde los proveedores envían facturas; desembocan en el mismo punto de entrada ("hay una factura nueva disponible"). El Área no cambia.
- **Banca online** — integración que aporta los movimientos automáticamente, eliminando el gesto manual. El Área sigue recibiendo "movimientos disponibles para conciliar" igual que hoy.
- **Portales de proveedores y descarga de adjuntos** — otras vías de entrada de facturas, mismo punto de desemboque.
- **Envío automático a gestoría** — si la plataforma externa lo permitiera.

El principio que lo hace posible: el origen de las entradas es indiferente para el Área (ya en la especificación). Toda vía nueva desemboca en los mismos dos hechos —"factura disponible" y "movimientos disponibles"— y el Área se comporta igual.

---

## Cierre

Este documento describe qué necesita y cómo se comporta el Área de Facturas, sin decidir cómo se construye. Su sección 0 aísla lo que toca la arquitectura común, para que se resuelva en 03–07 y DECISIONS, no aquí.

Siguiente paso: la fase de CTO toma la sección 0 y actualiza los documentos comunes (nuevo objeto Movimiento bancario y Categoría de gasto en 03, relación de conciliación en 03, excepción 047 y capacidad IA en 05/07, permiso de vista económica en 04), registrando cada cambio en DECISIONS. Solo después, Claude Code implementa.

*Diseño funcional del Área de Facturas — terminado.*

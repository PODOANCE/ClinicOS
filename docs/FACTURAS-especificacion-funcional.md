# ESPECIFICACIÓN FUNCIONAL · ÁREA DE FACTURAS

*La verdad funcional del Área de Facturas: cómo funciona el negocio, no cómo se construye. Sin diseño técnico, arquitectura, base de datos ni pantallas. Este documento describe el trabajo real; la representación en la aplicación vendrá después.*

*Estado: primera versión completa, para revisar buscando huecos.*

---

## 1. Propósito del Área

El Área de Facturas no es un gestor de facturas ni un almacén de PDFs. Es un **motor de justificación contable asistido por IA**.

Su objetivo real: **que todos los movimientos económicos de la empresa queden justificados documentalmente o explicados.** Cada pago que sale del banco debe poder justificarse; cada factura que llega debe encontrar su lugar. Las facturas son una entrada y los movimientos bancarios son otra; el producto consiste en hacer que ambos mundos cuadren y señalar únicamente aquello que necesita atención humana.

El eje del Área no es la factura ni el movimiento bancario: es la **justificación**. Ambas entradas son igual de importantes y ninguna es el punto de partida exclusivo. La conciliación es simplemente el mecanismo que relaciona ambos mundos. El almacenamiento de facturas es solo el punto de entrada; la conciliación es el mecanismo principal; la justificación es el fin.

Nota sobre el origen de este enfoque: la herramienta anterior partía forzosamente del movimiento bancario y gestionaba todo a mano, porque en su momento no existía IA capaz de leer facturas. Esa era una limitación de implementación, no del producto. El nuevo Área no la hereda: recibe facturas y movimientos como dos entradas igualmente válidas.

## 2. Principios funcionales

Los principios descubiertos durante el análisis, que gobiernan todo el comportamiento del Área:

- **El Área justifica movimientos económicos, no solo almacena facturas.** El propósito es que cada movimiento quede explicado, con factura o con otra justificación válida.
- **La IA es el usuario principal del proceso.** El trabajo normal lo hace la IA; la persona interviene solo cuando la IA no puede continuar con confianza.
- **La IA nunca inventa.** Ni datos de una factura, ni una conciliación. Si hay confianza suficiente, actúa; ante cualquier duda razonable, no decide y deja el caso para revisión humana.
- **Ninguna incidencia desaparece por una suposición.** Una incidencia solo se cierra cuando existe una justificación suficiente, automática o validada por una persona.
- **El estado final de toda incidencia es una justificación, no necesariamente una factura.** El movimiento o la factura queda correctamente explicado y deja de requerir intervención humana.
- **La conciliación es incremental.** Cada ejecución trabaja solo sobre facturas nuevas y movimientos aún pendientes. Lo ya conciliado no se vuelve a tocar; un movimiento conciliado se marca para no reutilizarse nunca.
- **La conciliación no asume relación uno a uno.** Debe poder representar relaciones uno-a-uno, uno-a-muchos y muchos-a-uno (un pago que agrupa varias facturas, una factura pagada en varios movimientos, etc.).
- **El origen de la factura es indiferente para el Área.** Cualquier vía de entrada desemboca en un único hecho: "hay una factura nueva disponible para procesar". Ninguna regla depende del origen.
- **La comprensión de una factura es completa, no una lista cerrada de campos.** La IA interpreta el documento entero y estructura toda la información relevante que encuentre, con un nivel de confianza por dato.
- **Un solo análisis, múltiples resultados.** Cada factura se analiza una única vez. De ese análisis derivan todos los resultados del Área —conciliación, clasificación de gasto, búsqueda, estadísticas, informes, consultas mediante IA y alimentación del Panel 360— sin duplicar motores ni volver a procesar el documento.
- **El Área es la fuente de verdad económica de la plataforma.** No es un gestor de facturas aislado: es el origen de la información económica que alimenta el Panel 360 y cualquier consulta de gasto de la aplicación.
- **La clasificación del gasto es una consecuencia del análisis, no una tarea aparte.** Al comprender la factura, la IA clasifica automáticamente el gasto en una o varias categorías de negocio. No existe un proceso separado de categorización.
- **El sistema aprende a categorizar.** Cuando una persona corrige o asigna una categoría, el sistema aprende esa decisión para aplicarla automáticamente a casos futuros similares.

## 3. Actores

- **La IA** — el actor principal. Detecta facturas nuevas, las interpreta, ejecuta la conciliación y genera las incidencias. Realiza la mayor parte del trabajo.
- **La persona que gestiona las facturas** (normalmente administración) — interviene solo cuando hay incidencias o trabajo que la IA no puede hacer: aporta los movimientos bancarios, resuelve incidencias y sube la documentación a la gestoría.
- **La gestoría** — actor externo, receptor final de las facturas preparadas. No opera dentro del Área.

## 4. Entradas

El Área recibe dos entradas principales:

- **Facturas.** Documentos que llegan a la clínica (material, servicios, suministros, compras). El origen es indiferente; todas terminan disponibles para procesar. La unidad funcional es una factura.
- **Movimientos bancarios.** El conjunto de movimientos económicos del periodo, aportados para poder conciliar. Representan los pagos reales que hay que justificar.

*Cómo llegan técnicamente ambas entradas (carpeta, correo, Excel, CSV, integración) es implementación y no se decide aquí.*

## 5. Flujo normal completo (happy path)

Desde que aparece una factura hasta que queda preparada para la gestoría, sin excepciones:

1. Todas las facturas que llegan a la clínica terminan disponibles para el Área. Para el Área solo existe el hecho de que hay una factura nueva por procesar.
2. La IA detecta las facturas nuevas que aún no han sido procesadas.
3. La IA interpreta completamente cada factura y genera una representación estructurada de toda su información, con nivel de confianza suficiente. De ese mismo análisis clasifica automáticamente el gasto en una o varias categorías de negocio.
4. La IA dispone de los movimientos bancarios del periodo, pendientes de conciliar.
5. La IA correlaciona cada factura con su movimiento correspondiente usando toda la información disponible (importe, fecha, proveedor, concepto y cualquier otro dato útil).
6. Cuando encuentra una correspondencia fiable, marca la factura y el movimiento como conciliados. Ese movimiento no volverá a usarse en futuras revisiones.
7. La factura conciliada pasa automáticamente a "preparada para la gestoría", agrupada con las demás del periodo.
8. Cuando llega el momento, una persona accede a las facturas preparadas y las sube al portal de la gestoría. Este paso es manual porque requiere autenticación y acceso a una plataforma externa.

En el flujo normal, el trabajo humano se reduce a dos gestos: aportar periódicamente los movimientos bancarios y subir las facturas preparadas a la gestoría. Todo lo demás es automático.

## 6. Motor de conciliación

El corazón del Área.

- **Qué entra:** el conjunto de facturas pendientes de conciliar y el conjunto de movimientos bancarios pendientes.
- **Qué hace:** analiza ambos conjuntos completos (no factura a factura de forma aislada), busca las correspondencias fiables usando toda la información disponible, crea la relación entre los elementos que casan, y los marca como conciliados. Itera hasta que no puede encontrar más correspondencias fiables.
- **Qué sale:** tres resultados — facturas y movimientos **conciliados**; **facturas sin movimiento**; **movimientos sin factura**.
- **Qué principios sigue:** es incremental (solo lo pendiente); no asume relación uno a uno; y nunca inventa una conciliación (ante la duda, deja el caso como incidencia).

*Cómo decide la fiabilidad, cómo resuelve conflictos, con qué criterios o pesos: es diseño del motor, no se define aquí.*

## 7. Catálogo de incidencias

Todo lo que el motor o la comprensión no pueden resolver automáticamente:

1. El documento no es una factura.
2. La IA no puede interpretar correctamente una factura (confianza insuficiente).
3. Existe una factura pero no aparece ningún movimiento que la justifique.
4. Existe un movimiento pero no aparece ninguna factura que lo justifique.
5. Existen varias conciliaciones posibles y la IA no tiene confianza para decidir.
6. Se detecta un posible duplicado.
7. El documento está corrupto o es ilegible.
8. Cualquier otro caso en el que la IA no pueda continuar con confianza suficiente.

## 8. Estado final esperado de cada incidencia

Qué significa que cada incidencia deja de ser un problema para el negocio. En todos los casos, el fin es una justificación suficiente, no necesariamente una factura.

1. **No es una factura** → el documento queda identificado como "no es una factura" y apartado del flujo; deja de contar como pendiente. *(A validar: si se conserva registrado o se descarta del todo.)*
2. **No se pudo interpretar** → la factura queda correctamente entendida (con datos válidos, aportados o corregidos por una persona) y vuelve al flujo normal para buscar su justificación. Si es irrecuperable, se descarta. *(A validar.)*
3. **Factura sin movimiento** → la factura queda explicada: aún no se ha pagado; el pago es de otro periodo; se pagó por otro método; o es un error. Deja de ser incidencia cuando tiene explicación coherente, no necesariamente cuando aparece un movimiento.
4. **Movimiento sin factura** → el movimiento queda justificado: aparece la factura y se concilia; se identifica que no requiere factura (comisión, impuesto, transferencia interna, devolución…); pertenece a otro periodo y queda pendiente para una pasada futura; o se detecta un error real a resolver fuera del sistema.
5. **Varias conciliaciones posibles** → una persona determina cuál es la correcta y el emparejamiento queda hecho. Deja de existir cuando alguien confirma qué va con qué.
6. **Posible duplicado** → una persona confirma: si es duplicado, se descarta la copia; si no, se marca como factura legítima distinta. *(A validar.)*
7. **Corrupto o ilegible** → se consigue una versión legible y entra al flujo, o se descarta si es irrecuperable. *(A validar.)*
8. **Otros** → una persona lo revisa y decide: se justifica y vuelve al flujo, o se descarta.

## 9. Trabajo humano

**Trabajo que desaparece gracias a la IA:** leer cada factura a mano, teclear sus datos, buscar manualmente qué pago corresponde a cada factura, y cruzar facturas con el extracto bancario una a una. Todo el trabajo repetitivo de comprensión y cruce lo hace la IA.

**Trabajo humano que permanece:**
- Aportar periódicamente los movimientos bancarios (hasta que exista integración bancaria).
- Subir las facturas preparadas al portal de la gestoría.
- Resolver las incidencias que la IA no puede cerrar con confianza: aportar una factura que falta, explicar un movimiento sin factura, confirmar un duplicado, corregir una interpretación dudosa, decidir entre varias conciliaciones posibles.
- Corregir puntualmente una categoría de gasto mal asignada. Cada corrección enseña al sistema para el futuro, de modo que este trabajo tiende a reducirse con el tiempo.

El trabajo humano deja de ser "procesar todas las facturas" y pasa a ser "atender solo lo que necesita criterio humano". La persona trabaja sobre la excepción, no sobre la norma.

## 11. Capacidades heredadas y capacidades nuevas

Separación entre lo que la herramienta anterior ya demostró útil (a trasladar) y lo que es completamente nuevo (a diseñar). Responde a "qué parte ya existe y qué parte habrá que crear".

**Capacidades heredadas (ya validadas en la herramienta anterior, se trasladan):**
- Registro de movimientos bancarios y detección de duplicados por huella (fecha + importe + concepto).
- Estados de justificación de un movimiento: sin justificar → justificación conseguida → subida a gestoría.
- Clasificación del gasto por categorías de negocio.
- Aprendizaje de reglas de categorización a partir de las decisiones de la persona: al asignar una categoría a un concepto, el sistema recuerda el patrón y lo sugiere en el futuro.
- Panel de justificación ("¿está todo justificado?"): visión de lo que queda sin justificar.
- Vista de gasto por categoría con comparación entre periodos, como base del futuro Panel 360.
- Trazabilidad del trabajo humano: quién marcó cada cosa y cuándo.

**Capacidades nuevas (no existían; se diseñan desde cero):**
- Entrada de facturas como documento (PDF u otros), con origen indiferente.
- Lectura e interpretación completa de la factura mediante IA, con extracción estructurada y nivel de confianza por dato.
- Motor de conciliación automática que relaciona facturas y movimientos usando toda la información disponible.
- Generación automática de incidencias cuando la IA no puede continuar con confianza.
- Clasificación automática del gasto derivada del análisis de IA (frente a la categorización manual anterior).
- El principio de análisis único que alimenta todos los resultados del Área.

El paso conceptual entre ambas: la herramienta anterior justificaba movimientos a mano; el nuevo Área automatiza la comprensión y la conciliación, y reserva a la persona solo lo que requiere criterio.

## 12. Evoluciones futuras

Registradas, no diseñadas:

- **Lectura automática del correo** — un buzón donde los proveedores envían facturas, incorporadas sin intervención.
- **Descarga automática de adjuntos** y de portales de proveedores.
- **Integración bancaria** — obtener los movimientos automáticamente, eliminando el último gesto manual de aportarlos.
- **Automatización del envío a la gestoría** — si la plataforma externa lo permitiera en el futuro.
- **Separación automática de un archivo con varias facturas.**
- **Consultas mediante IA sobre el histórico económico** — búsqueda inteligente y preguntas en lenguaje natural sobre facturas, gastos y movimientos acumulados.

Ninguna de estas cambia el flujo funcional definido; solo cambian cómo entra la información o qué se hace con ella después. (La clasificación de gasto, las estadísticas por categoría y la alimentación del Panel 360 dejan de ser evoluciones futuras: son capacidades de la v1.)

---

## Decisiones pendientes (para las fases posteriores)

Anotadas durante el análisis, a resolver en el diseño funcional de la app y, si procede, en la arquitectura común:

- **Objeto "Movimiento bancario"** — se comporta como un objeto con estado propio (pendiente / conciliado / justificado sin factura). Probablemente deba incorporarse al modelo de datos (03).
- **Relación Factura ↔ Movimiento** — no es uno a uno; es de muchos a muchos. Hay que poder representarla.
- **Estado "justificado sin factura"** — un movimiento explicado que no lleva documento (comisión, impuesto…). Concepto nuevo a representar.
- **Objeto "Categoría de gasto"** — aparece tanto en Facturas como en el Panel 360. Si ambos la usan, es un objeto compartido (como Proveedor), no propio de un Área. Conecta con el principio de objetos únicos (03).
- **Relación con el Panel 360** — el Área de Facturas alimenta el Panel 360 con la información económica clasificada. La frontera entre ambas Áreas y cómo fluye esa información es decisión de diseño posterior.
- **Excepción a la decisión 047** — la automatización (lectura de PDF y conciliación) es núcleo de la v1 de esta Área, no mejora futura. A registrar en DECISIONS.
- Criterios de fiabilidad de la conciliación, detección de duplicados, datos mínimos, estados internos, mecanismo de aprendizaje de categorías: diseño del Área, no análisis funcional.

---

*Fin de la especificación funcional. Pendiente de revisión buscando huecos, antes de pasar a la representación en la aplicación.*

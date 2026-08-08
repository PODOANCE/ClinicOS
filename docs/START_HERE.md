# START HERE

Punto de entrada a la documentación de la plataforma interna de Podología y Biomecánica Rivas. Léelo antes que nada. Si eres una IA que va a construir o modificar la plataforma, consulta este documento al empezar cada sesión.

## Qué es esto

La documentación fundacional de una plataforma interna de gestión: el sistema operativo desde el que la clínica coordina su trabajo, complementario a Organízate (que sigue siendo el software clínico). La plataforma organiza trabajo, no información: las cosas que pasan generan tareas, y cada persona las encuentra en Hoy.

## Orden de lectura

Los documentos están numerados y se leen en orden. Cada uno se apoya en los anteriores.

- **00-VISION** — por qué existe el proyecto. El propósito.
- **01-PRINCIPLES** — los 10 principios. La constitución del producto.
- **02-PRODUCT** — qué es la plataforma para un humano: Hoy, Áreas, Objetos, y cómo se relacionan.
- **03-DATA_MODEL** — qué objetos existen, cómo se relacionan y qué guarda cada uno. Incluye el contrato de la Tarea.
- **04-ROLES** — quién accede a qué, con qué acciones y con qué ámbito.
- **05-ARCHITECTURE** — cómo se construye la casa y por qué. El stack, la anatomía de un Área, los principios de arquitectura.
- **06-UX** — cómo se ve y se usa: identidad visual, sistema de diseño, patrones, estados.
- **07-BUILD_PLAN** — en qué orden se construye y con qué criterios. El puente hacia el desarrollo.

## Qué documento gobierna cada decisión

Ante una duda, la autoridad es:

- **Qué construir y qué es el producto** → 00, 01, 02.
- **Qué datos existen y cómo se relacionan** → 03.
- **Quién puede hacer qué** → 04.
- **Cómo se estructura el código y la arquitectura** → 05.
- **Cómo se ve y se comporta la interfaz** → 06.
- **En qué orden se construye** → 07.

**01-PRINCIPLES está por encima de todos:** si una decisión contradice un principio, la decisión está equivocada. Y de entre los principios, el 10 (mantenible por una persona con IA) es la ley que protege a las demás.

## Documentos vivos

Dos documentos no se "cierran": crecen con el proyecto.

- **DECISIONS** — el registro de todas las decisiones tomadas, con su porqué. **Es la autoridad sobre cambios:** si algo se decide o se cambia, se registra aquí. Ante una contradicción entre documentos, DECISIONS dice qué versión es la vigente. No se borran decisiones revertidas: se marcan y se añade la nueva.
- **BACKLOG** — las ideas buenas que no se construyen todavía. Nada aquí está rechazado, solo aparcado hasta que haya un caso real que lo justifique.

## Qué consultar antes de cada sesión de desarrollo

1. **07-BUILD_PLAN** — para saber en qué fase estás y qué toca construir ahora.
2. **DECISIONS** — para no reabrir nada ya decidido ni contradecir una decisión vigente.
3. El documento específico de lo que vayas a tocar (03 si es un objeto, 04 si son permisos, 05 si es estructura, 06 si es interfaz).

Regla de oro durante la construcción (07, sección 8): la documentación es la fuente y el código la obedece. Si una decisión no está tomada, se para, se decide, se registra en DECISIONS, y luego se construye. El código nunca es donde se toman las decisiones de diseño.

## Estado actual

Fase de documentación cerrada. El siguiente paso antes de escribir código es la descomposición del flujo de trabajo real de recepción, que decidirá cuál es la primera Área (Fase 3 del BUILD PLAN). Todo lo demás del plan (Fases 0, 1 y 2) es independiente de esa decisión.

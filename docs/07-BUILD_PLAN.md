# 07 · BUILD PLAN

*El puente entre la documentación y el desarrollo. No define el producto (eso está cerrado en 00–06): define el plan de construcción —en qué orden se construye y cómo empezar sin romper la arquitectura—. Es secuencia y criterios, no implementación: el código pertenece a Claude Code; este documento dice qué construir antes que qué y cuándo una parte está lista.*

*Estado: cerrado. Define el orden de construcción y los criterios para avanzar. Es secuencia y criterios, no implementación.*

---

## 1. Propósito del BUILD PLAN

Los seis documentos fundacionales responden **qué** construir y **cómo debe ser**. Ninguno responde **en qué orden** ni **cómo empezar sin romper nada**. Este documento cubre esa categoría distinta: la ejecución.

Sirve para tres cosas concretas:

- **Fijar el orden de construcción**, de modo que cada pieza se apoye en las anteriores y nada se construya antes de tiempo ni se rehaga después.
- **Ser el guion de cada sesión de desarrollo con Claude Code**: en vez de empezar cada sesión decidiendo "¿y ahora qué toca?" —que es donde se cometen errores de arquitectura—, la respuesta ya está escrita aquí.
- **Definir cuándo una fase está terminada**, para no arrastrar trabajo a medias a la fase siguiente.

Lo que este documento NO es: no es código, no es un tutorial técnico, no define pantallas concretas. Es el plan. Igual que 05 definió la arquitectura sin escribir código, 07 define el plan sin escribirlo.

## 2. Reglas generales de construcción

Las leyes que gobiernan toda la construcción, por encima de cualquier fase concreta.

**2.1 No se avanza de fase sin cerrar la anterior.** Cada fase tiene sus criterios de "terminado" (sección 7). Mientras no se cumplan, no se empieza la siguiente. Una fase a medias que se abandona por empezar la próxima es deuda garantizada.

**2.2 Lo común antes que lo específico.** Primero el terreno, luego la shell, luego los componentes compartidos, y solo entonces la primera Área. Se construye de lo que sostiene hacia lo que se sostiene, nunca al revés.

**2.3 La arquitectura manda sobre la prisa.** Ninguna fase se acelera saltándose los principios de 05 (una Área nunca reinventa la shell, cero lógica duplicada, componentes reutilizables, complejidad localizada). Ir rápido rompiendo la arquitectura es ir lento con retraso.

**2.4 Cada pieza nace en su sitio definitivo.** Un componente que van a usar varias Áreas nace como componente compartido, no dentro de un Área para extraerlo después. Construir en el sitio equivocado "para ir rápido" siempre cuesta más al final.

**2.5 Se construye lo que se necesita ahora, no lo que se necesitará algún día.** Ninguna fase adelanta trabajo de una futura por anticipación. Lo que no se usa todavía, no se construye todavía (coherente con todo el proyecto).

**2.6 Terminado y sólido, no perfecto.** Una fase se cierra cuando cumple su función y sus criterios de calidad, no cuando es perfecta. El objetivo es una base sólida sobre la que seguir, no el pulido infinito de cada pieza. Pero terminado significa terminado: una fase no puede darse por cerrada dejando trabajo conocido pendiente para la siguiente. Si existe una excepción justificada, se registra explícitamente en DECISIONS o BACKLOG; nunca se arrastra de forma tácita.

**2.7 Todo cambio respeta el flujo único.** Toda acción sigue el recorrido usuario → interfaz → permisos → lógica → datos → interfaz (05, sección 7). Ninguna fase introduce caminos alternativos para hacer lo mismo.

**2.8 Una sola fuente de verdad.** Cada decisión vive en un único documento. El BUILD PLAN referencia la arquitectura, el modelo de datos, los roles y el sistema de diseño, pero no los duplica. Si una decisión cambia, se modifica en su documento original, no aquí.

**2.9 Una fase solo puede modificar fases anteriores para reforzarlas, nunca sustituirlas.** Si durante la construcción de un Área se detecta una mejora necesaria para la shell, el sistema de diseño o los componentes compartidos, esa mejora se realiza en su lugar correspondiente y se actualiza para todo el sistema. Nunca se resuelve únicamente dentro del Área que la descubre.

## 3. Fase 0 · Preparación del proyecto

El terreno sobre el que se levanta todo. Nada de producto todavía: solo dejar el esqueleto vacío funcionando de punta a punta, para que a partir de ahí cada cambio se publique con seguridad.

Qué se prepara en esta fase:

- **El repositorio único.** Un solo repositorio para toda la plataforma (monolito modular, decisión 002). La estructura de carpetas inicial refleja la separación de 05: un lugar para la shell, un lugar para los componentes compartidos, un lugar para los objetos, un lugar para las Áreas. La casa vacía, con sus divisiones marcadas.
- **La conexión con Supabase.** La capa de datos y autenticación existente queda conectada al proyecto. Se confirma que la plataforma puede hablar con Supabase, sin construir todavía ninguna lógica de negocio.
- **El despliegue en Vercel.** El proyecto se publica automáticamente desde el repositorio, aunque solo muestre una página vacía. El objetivo es que el circuito completo —escribir un cambio, que se publique solo— funcione desde el primer día. Así, cuando empiece el trabajo real, publicar no es un problema nuevo, es algo ya resuelto.
- **Las convenciones base del proyecto.** Cómo se nombran las cosas, cómo se organizan las carpetas, dónde va cada tipo de pieza. Se fijan ahora, en vacío, para que todo lo que venga después las siga sin excepción.

Por qué esta fase existe y va primera: separa los problemas de infraestructura (que se resuelven una vez) de los problemas de producto (que se resuelven en cada Área). Cuando la Fase 0 está cerrada, nunca más hay que preocuparse de "cómo se publica esto" o "dónde va este archivo": el terreno está firme y el foco pasa entero al producto.

---

*Fin del bloque 1 (secciones 1-3), cerrado y validado.*

---

## 4. Fase 1 · Shell

El esqueleto donde vivirán todas las Áreas: lo que se construye una vez y todas heredan (05, sección 3). Al terminar esta fase existe una plataforma en la que se puede entrar, navegar y en la que los permisos funcionan —aunque todavía no haya ninguna Área con contenido real.

Qué se construye, en este orden:

- **Autenticación.** El login sobre Supabase Auth. Una persona puede entrar con sus credenciales y salir. La sesión se mantiene. Es lo primero porque todo lo demás depende de saber quién entra.
- **Usuarios y roles.** El objeto Usuario y el objeto Rol del modelo de datos (03, sección 4), con el mecanismo único de permisos: un usuario tiene uno o varios roles, y cada rol define qué Áreas ve y qué acciones permite (04). Aquí se hace realidad la ocultación total.
- **El layout y la navegación.** La estructura visual permanente: la navegación lateral con las Áreas (solo las que el rol permite ver), la cabecera, y el marco donde se cargará cada Área. Es el mismo marco para todo, siempre en el mismo sitio.
- **El enrutado por permisos.** Que cada persona, al entrar, solo pueda llegar a lo que su rol permite —tanto en lo que ve como en lo que puede abrir directamente—. Lo prohibido es invisible y también inaccesible (04 y 06, sección 7.5).

Por qué la shell va antes que nada de producto: es el contrato que toda Área debe respetar (05, sección 3). Si la shell no está sólida primero, cada Área tendería a resolver la navegación o los permisos a su manera, y se rompería la coherencia desde el primer día. La shell primero es lo que garantiza que la Área número veinte cueste como la primera.

Nota: en la navegación solo se muestran las Áreas existentes y utilizables para el rol. No hay Áreas vacías, etiquetas de "próximamente" ni elementos deshabilitados: lo que no existe o no corresponde al rol, no aparece (coherente con la ocultación total de 04 y 06). Lo que sí queda terminado en esta fase es el mecanismo: entrar, ver según rol, navegar.

## 5. Fase 2 · Sistema de diseño y componentes base

El lenguaje visual de 06 convertido en piezas reales y reutilizables, antes de construir ninguna Área. Al terminar esta fase existe un catálogo de componentes compartidos que cualquier Área usará sin rehacerlos.

Qué se construye:

- **Los fundamentos visuales.** Los valores del sistema de diseño (06, sección 3) hechos realidad: la paleta, el espaciado en múltiplos de 4, los radios, la elevación, la tipografía. Con la tipografía temporal compatible mientras se confirma la licencia de NOW BLACK; sustituible después sin tocar nada más, porque vive en un solo sitio.
- **Los componentes base compartidos**, cada uno según los patrones de 06 (sección 6): la tabla (con ordenar, filtrar, paginar, seleccionar, abrir detalle), el formulario (una columna, etiqueta encima, errores junto al campo, guardar/cancelar), el botón (primario único con Banana, secundarios neutros), el modal, y los componentes de estado (vacío, carga con skeletons, éxito, error).
- **Los patrones de estado transversales.** Cómo se ve una pantalla vacía, una cargando, un error que no pierde trabajo (06, sección 7). Construidos como piezas compartidas, no reinventados en cada Área.

Por qué esta fase va antes de la primera Área: una Área se construye ensamblando estos componentes. Si se construyera la Área primero, sus componentes nacerían dentro de ella y habría que extraerlos después —retrabajo y riesgo de incoherencia (regla 2.4)—. Los componentes base nacen compartidos desde el primer día. Esta es la fase que hace que todas las Áreas se parezcan.

Criterio de alcance: en esta fase se construyen los componentes que se sabe que toda Área necesita (tabla, formulario, botón, estados, modal). No se construyen componentes especulativos "por si acaso" (regla 2.5): si una Área futura necesita uno nuevo y reutilizable, se añadirá al catálogo compartido entonces.

## 6. Fase 3 · Primera Área

La primera habitación completa, construida siguiendo el contrato de Área (05, sección 4) sobre la shell y con los componentes base. Es doblemente importante: entrega el primer valor real de la plataforma, y sirve de **molde de referencia** para todas las Áreas futuras. Cómo se construya esta marcará cómo se construyen las demás.

**Qué Área concreta será se decide después**, cuando terminemos la descomposición del flujo de trabajo. Ese análisis dirá qué Área quita más fricción y es mejor primera. El plan de *cómo* construir una Área, en cambio, es independiente de cuál sea, y es lo que esta sección fija.

La estrategia para construir una Área, siguiendo los cinco pasos de 05 (sección 6):

1. **Los objetos.** Confirmar qué objetos del modelo de datos usa esta Área (03). Si ya existen, se reutilizan; si alguno es nuevo, se crea siguiendo las reglas comunes (identidad, archivado, autoría). Ningún objeto se duplica.
2. **Los permisos.** Definir qué roles ven el Área y con qué acciones (04). Sin permisos definidos, el Área no se despliega.
3. **La anatomía estándar.** Montar las cinco zonas visuales (06, sección 4) ensamblando los componentes base de la Fase 2. No se crea ningún componente nuevo que pudiera ser compartido sin añadirlo al catálogo común.
4. **La lógica de negocio propia.** Lo único específico del Área: sus reglas y qué tareas genera cuando ocurre algo. Escrita a mano y localizada (sin motor genérico, decisión 010; complejidad localizada, 05 principio 5.6).
5. **La conexión con las tareas.** Definir qué hechos del Área generan qué tareas y para quién, de modo que el trabajo llegue al Hoy de la persona adecuada.

Al terminar esta fase existe una Área funcionando de punta a punta, y —tan importante como eso— un patrón demostrado y repetible. La segunda Área ya no se diseña: se replica este molde cambiando objetos y lógica.

Nota de método: mientras se construye esta primera Área, es probable que aparezcan mejoras para la shell o los componentes base. Esas mejoras se hacen en su sitio (shell o catálogo compartido), no dentro del Área (regla 2.4 y principio de una sola fuente de verdad). La primera Área también sirve para pulir los cimientos con un caso real.

Regla de validación: la segunda Área debe requerir menos esfuerzo que la primera. Si al empezar la segunda Área aparece la necesidad de rehacer la shell, el sistema de diseño o los componentes compartidos, la Fase 3 no estaba realmente terminada y debe revisarse antes de continuar. El coste de la segunda Área es la prueba objetiva de que los cimientos quedaron bien.

---

*Fin del bloque 2 (secciones 4-6), cerrado y validado.*

---

## 7. Criterios de "terminado" de cada fase

Las puertas de calidad. Una fase no se cierra —ni se empieza la siguiente— hasta cumplir todos sus criterios (regla 2.1 y 2.6). "Terminado" significa terminado, sin trabajo conocido pendiente arrastrado en silencio.

**Fase 0 · Preparación — terminada cuando:**
- Existe el repositorio único con la estructura de carpetas que refleja la arquitectura (shell, compartidos, objetos, Áreas).
- La plataforma se conecta con Supabase de forma verificada.
- Un cambio escrito se publica automáticamente en Vercel, de punta a punta.
- Las convenciones base (nombres, organización) están fijadas y escritas.

**Fase 1 · Shell — terminada cuando:**
- Una persona puede entrar y salir con sus credenciales, y la sesión se mantiene.
- Existen Usuario y Rol con el mecanismo único de permisos (Área + acciones).
- La navegación muestra solo las Áreas utilizables por el rol; lo demás es invisible e inaccesible.
- La ocultación total funciona de verdad: lo oculto no es solo invisible, es inalcanzable.
- El marco de navegación y cabecera es estable y común para todo lo que venga.

**Fase 2 · Sistema de diseño — terminada cuando:**
- Los valores del sistema de diseño (paleta, espaciado, radios, elevación, tipografía) existen en un solo sitio y se aplican de forma coherente.
- Existen como componentes compartidos: tabla, formulario, botón, modal y los componentes de estado (vacío, carga, éxito, error).
- Cada componente respeta su patrón de 06 (botón primario único, tabla con sus comportamientos, formulario con sus reglas, error que no pierde trabajo).
- La tipografía temporal está en un único lugar, sustituible por NOW BLACK sin tocar nada más.

**Fase 3 · Primera Área — terminada cuando:**
- El Área funciona de punta a punta siguiendo el contrato: cinco zonas, objetos reutilizados, permisos definidos, lógica propia, tareas conectadas al Hoy.
- No contiene ningún componente que debería ser compartido y vive dentro del Área.
- Genera tareas reales que aparecen en el Hoy de la persona adecuada.
- Cumple la prueba de la segunda Área: replicarla costaría menos que construirla, sin rehacer cimientos.

## 8. Reglas de desarrollo con Claude Code

Cómo se trabaja en cada sesión de construcción para que el código respete lo decidido. Estas reglas son las barandillas que mantienen la ejecución alineada con los siete documentos.

**8.1 La documentación es la fuente; el código la obedece.** Ante cualquier duda de qué construir o cómo debe comportarse, la respuesta está en los documentos (00–06), no se improvisa. Si un documento no lo cubre, se decide y se registra en DECISIONS antes de codificar, no después.

**8.2 Una sesión, un objetivo claro.** Cada sesión de trabajo aborda una pieza concreta del plan (una parte de una fase), no varias a la vez. Terminar y verificar una pieza antes de abrir otra.

**8.3 Se construye sobre lo que ya existe.** Antes de crear algo, se comprueba si ya existe un componente, un objeto o un patrón que sirva. No se crea lo que ya está (cero duplicación, 05).

**8.4 Cada pieza en su sitio.** Lo compartido va al catálogo común; lo propio de una Área, dentro del Área; los valores de diseño, en el sistema de diseño. Nada se coloca "temporalmente" en el sitio equivocado.

**8.5 Cambios pequeños y verificables.** Se avanza en pasos que se pueden comprobar, no en saltos grandes difíciles de revisar. Un cambio que no se puede verificar es un riesgo, no un avance.

**8.6 Si una decisión no está tomada, se para y se decide.** Cuando durante la construcción aparece una decisión de producto o arquitectura no resuelta, no se resuelve improvisando en el código: se decide como Product Owner y CTO, se registra, y luego se construye. El código nunca es donde se toman las decisiones de diseño.

**8.7 Lo estándar sobre lo ingenioso.** Entre una solución común y bien conocida y una más lista pero rara, se elige la común (05, principio 5.9). Es lo que mantiene el proyecto mantenible con IA.

## 9. Qué no se construye todavía

Las tentaciones a resistir durante la construcción inicial. Están escritas para que no se cuelen "de paso".

- **Ninguna Área más allá de la primera.** Hasta que la primera Área cierre y pase la prueba de la segunda, no se empieza otra. La disciplina del molde antes que la prisa de llenar la casa.
- **Ningún motor de eventos, flujos configurables ni automatizaciones genéricas.** Los flujos se escriben a mano en su Área (decisión 010). Aparcado en BACKLOG hasta que existan muchos flujos reales.
- **Ninguna capa de "capacidades", objeto "Actividad" ni abstracción aparcada** (BACKLOG). No se adelantan por elegancia.
- **Ningún componente especulativo.** Solo se construyen los componentes que la primera Área necesita de verdad. Los demás, cuando una Área los pida.
- **Nada clínico.** Ni pacientes, ni historia, ni agenda, ni Verifactu. La frontera con Organízate es intocable (03, principio 1.9).
- **Ninguna optimización prematura.** No se optimiza rendimiento ni se refina lo que aún no ha demostrado necesitarlo. Primero que funcione y sea claro; optimizar solo lo que el uso real señale.
- **Ningún multi-centro todavía.** El modelo está preparado para varias sedes, pero no se construye esa complejidad mientras haya una sola (decisión 026).

---

## Cierre

Con este documento, la planificación está completa. Existe el **qué** (00–02), el **con qué** (03–04), el **cómo** (05–06) y ahora el **en qué orden** (07). Los siete documentos, más DECISIONS y BACKLOG vivos, son la base sobre la que empezar a construir con disciplina.

El orden de construcción queda fijado: terreno (Fase 0), shell (Fase 1), sistema de diseño (Fase 2), primera Área (Fase 3). Cada fase con su puerta de calidad, cada sesión con su regla, cada tentación con su freno.

Antes de escribir la primera línea de código queda un solo paso: la **descomposición del flujo de trabajo**, que decidirá qué Área concreta es la primera dentro de la Fase 3. Todo lo demás del plan es independiente de esa decisión y ya está cerrado.

El BUILD PLAN deja de ser un documento de diseño en el momento en que comienza la construcción. A partir de entonces solo podrá modificarse cuando exista una decisión arquitectónica explícita que justifique el cambio. No evoluciona al ritmo del código; el código evoluciona siguiendo el BUILD PLAN.

*07-BUILD PLAN — cerrado.*

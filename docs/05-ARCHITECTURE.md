# 05 · ARQUITECTURA

*Cómo está pensada la casa y por qué está construida así. Es un documento arquitectónico, no un manual técnico: explica qué piezas hay, para qué sirven y por qué se eligieron. El código pertenece a Claude Code; la arquitectura pertenece a este documento.*

*Estado: cerrado. Define cómo está pensada la casa y por qué. No es un manual técnico ni contiene código.*

---

## 1. Visión general de la arquitectura

La plataforma se organiza en tres capas, y entenderlas es entender todo el sistema.

**La interfaz** — lo que el usuario ve y toca: la pantalla de Hoy, las Áreas, las listas, los botones. Es la cara de la casa.

**Los datos y la lógica** — donde vive la información (los objetos del modelo de datos), quién puede acceder a qué (los permisos) y quién entra (la autenticación). Es el cerebro y la memoria de la casa. Toda la información existe aquí una sola vez, y la interfaz la consulta y la modifica.

**El alojamiento** — dónde está publicada la plataforma para que el equipo pueda usarla desde cualquier navegador. Es el terreno sobre el que se levanta la casa.

La regla que gobierna las tres capas: **la información vive en un solo sitio, la interfaz solo la muestra y la edita**. La interfaz nunca guarda su propia versión de las cosas. Esto es lo que hace posible el principio de "un objeto existe una sola vez": si todo pasa por la misma capa de datos, no hay copias que se desincronicen.

Por qué esta forma y no otra: es la disposición más estándar que existe para una aplicación de gestión, y esa es exactamente la virtud. Cuanto más común es la estructura, mejor la conoce la IA que ayudará a mantenerla, y menos sorpresas esconde cuando algo hay que arreglarlo. La arquitectura sirve al principio 10 desde su forma misma.

**El flujo único.** Toda acción sigue siempre el mismo recorrido: el usuario actúa desde la interfaz, la lógica decide qué ocurre, los datos se actualizan y la interfaz refleja el nuevo estado. Nunca existen caminos alternativos para hacer la misma cosa. Toda la plataforma funciona siempre igual, y esa uniformidad es lo que la hace predecible de usar y de mantener: quien entiende un recorrido, los entiende todos.

## 2. Los pilares tecnológicos

El stack está decidido. Aquí se explica cada pieza desde la arquitectura: qué es, para qué sirve, por qué se eligió y por qué encaja con el principio 10 (estándar, sencillo, mantenible con ayuda de IA). Sin implementación, sin comandos, sin código.

**Next.js y React** — la capa de interfaz. React es la forma más extendida que existe de construir interfaces web por piezas reutilizables; Next.js es el marco que la organiza y la hace funcionar como una aplicación completa. Se eligen porque son, con enorme diferencia, lo más usado y mejor documentado del mundo para esto: cualquier IA los conoce a fondo y acierta a la primera con patrones que ha visto un millón de veces. Elegir algo más "simple" pero minoritario daría *menos* ayuda de la IA, no más. Lo popular es aquí lo mantenible.

**Supabase** — la capa de datos y lógica. Guarda toda la información (los objetos del modelo), gestiona quién entra (autenticación) y controla quién accede a qué (permisos). Se eligió porque hace de forma nativa y estándar justo las tres cosas que la plataforma necesita como base común, sin tener que construirlas ni mantener un servidor propio para ellas. Menos piezas hechas a mano significa menos cosas que se rompen un martes. Además, ya se usa en las herramientas actuales de la clínica: no es tecnología nueva que aprender, es consolidar lo que ya funciona.

**Vercel** — la capa de alojamiento. Es donde la plataforma está publicada y accesible. Se eligió porque publica los cambios de forma automática y sin administrar servidores: se escribe una mejora y queda disponible sola. Encaja con el principio 10 porque elimina toda una categoría de trabajo de mantenimiento —la de administrar infraestructura— que una sola persona no debería cargar.

**El almacenamiento de archivos** — parte de Supabase. Los documentos (PDF de facturas, contratos, justificantes) se guardan en el sistema de archivos estándar que Supabase ya ofrece, y el objeto Documento solo guarda la referencia. No se inventa un sistema de archivos propio.

El hilo común de las cuatro elecciones: **ninguna es exótica, todas son la opción por defecto de la industria**. Eso no es falta de ambición; es la decisión deliberada que mantiene el proyecto vivo y mantenible a largo plazo por una persona con ayuda de IA.

## 3. La estructura de la casa

La plataforma es una sola casa con habitaciones, no un conjunto de casas separadas. Su estructura interna refleja esa idea.

**La shell** — la estructura común que comparten todas las Áreas. No solo el login, la navegación lateral, la cabecera y el sistema de diseño: también los permisos, los componentes, el comportamiento y la experiencia de usuario. La shell es la casa: las paredes, las puertas, la instalación eléctrica. Se construye una vez y todas las Áreas viven dentro de ella. Toda Área hereda de la shell la navegación, los permisos, los componentes, el comportamiento y la experiencia; una Área solo aporta su lógica de negocio. Todo lo demás ya existe. La shell no es solo infraestructura visual: es el contrato que toda Área debe respetar —misma navegación, mismos permisos, mismos componentes, misma anatomía, mismo comportamiento— y el que obliga a que todas las Áreas funcionen igual.

**Las Áreas** — las habitaciones. Cada una resuelve un asunto concreto (Facturas, Stock, Leads…) y cuelga de la shell. Una Área nunca construye su propia navegación, su propio login ni su propio diseño: los hereda de la shell. Solo aporta lo que es específico suyo: su lista, su detalle, sus acciones.

**Los elementos compartidos** — los componentes que todas las Áreas usan por igual: cómo se ve una lista, cómo se ve un botón de crear, cómo aparece un mensaje de éxito o error, cómo se muestra el detalle de un objeto. Viven en un solo lugar común y las Áreas los reutilizan. Nadie reinventa una tabla ni un botón: se toma el compartido. La regla que lo gobierna: si una solución puede reutilizarse en dos Áreas, deja automáticamente de pertenecer a una Área y pasa a ser un elemento compartido. Lo que sirve a dos, vive en el centro.

**Los objetos** — la representación de las cosas del modelo de datos (Factura, Proveedor, Tarea…), también en un lugar común, porque un objeto es el mismo lo use el Área que lo use.

La forma de la estructura en una frase: **lo común vive en el centro y se comparte; lo específico de cada Área vive en su habitación y no sale de ahí**. Esta separación es lo que permite añadir una habitación nueva sin tocar las demás, y lo que hace que todas las habitaciones se parezcan entre sí.

La arquitectura no está diseñada para construir la primera Área. Está diseñada para que la número veinte cueste casi lo mismo que la primera. Ese es su objetivo real, y la vara con la que se mide cualquier decisión arquitectónica: si algo hace más cara la Área número veinte, probablemente está mal.

---

*Fin del bloque 1-2-3, cerrado y validado.*

---

## 4. Anatomía de una Área

La pieza clave para poder mantener y hacer crecer la plataforma con ayuda de IA. Todas las Áreas tienen la misma anatomía por dentro. No se parecen "un poco": son el mismo esqueleto repetido, cambiando solo de qué objeto tratan. Quien entiende una Área, entiende todas.

Toda Área se compone siempre de las mismas partes:

La anatomía de una Área es un contrato arquitectónico. Toda Área nueva debe cumplirlo. Si una futura Área necesita romper este contrato, primero debe demostrarse que el contrato está mal, no que el Área es especial. El patrón es una regla, no una sugerencia.

**La vista principal (la lista).** Al entrar en una Área, lo primero es una lista de sus objetos: las facturas, los productos, los leads. Siempre se ve y se comporta igual —misma forma de tabla, misma manera de ordenar— cambie el objeto que cambie. Sobre la lista siempre están las mismas herramientas: buscar y filtrar.

**El detalle.** Al abrir un elemento de la lista, se ve su detalle: toda la información de esa factura, ese producto, ese lead. El detalle siempre se presenta igual y es también desde donde se accede a los objetos relacionados (desde una factura, su proveedor; desde un empleado, sus vacaciones).

**La acción principal.** Toda Área tiene una acción clara y siempre en el mismo sitio: crear una factura, registrar un lead, solicitar vacaciones. Es lo que el usuario viene a hacer, y nunca hay que buscarla.

**Las acciones sobre un elemento.** Editar, aprobar, archivar. Aparecen según los permisos del rol (principio de ocultación total) y siempre se comportan igual: aprobar una factura y aprobar unas vacaciones se sienten como la misma acción.

**La conexión con los objetos.** Una Área no es dueña de la información: trabaja sobre los objetos comunes. El Área de Facturas trabaja sobre Facturas, Proveedores y Documentos; el Área de Stock sobre Productos y Proveedores. Los objetos existen una sola vez; el Área es la ventana que los muestra desde su ángulo.

**La conexión con las tareas.** Cuando en un Área ocurre algo que genera trabajo (llega una factura, un stock baja del mínimo), el Área crea una Tarea dirigida a la persona adecuada. Esa tarea aparece en el Hoy de esa persona. Así es como el trabajo que nace dentro de un Área llega hasta quien debe resolverlo, sin que esa persona tenga que entrar a mirar. La lógica concreta de qué genera qué tarea es lo único verdaderamente propio de cada Área, y se escribe a mano dentro de ella (no hay motor genérico).

**El patrón Estado → Tarea.** Muchos objetos de un Área tienen un estado (una factura recorre estados hasta finalizar; una solicitud de vacaciones va de pendiente a resuelta). El patrón común que toda Área respeta, sin que sea un motor de workflow:

- **Los estados pertenecen a cada Área.** Qué estados tiene un objeto y cómo se pasa de uno a otro lo define el Área al diseñarse, no el sistema. No hay un catálogo global de estados.
- **Determinadas transiciones generan tareas.** Cuando un objeto entra en un estado que requiere trabajo humano (una factura pasa a "por revisar"), el Área crea la tarea correspondiente y la asigna a quien debe actuar.
- **La lógica del Área decide crear, completar o cancelar tareas.** Es el Área quien sabe que aprobar una factura completa la tarea de aprobación, o que archivar un objeto cancela sus tareas pendientes. El sistema no infiere nada de esto: lo ordena el Área.
- **La mecánica común queda fijada para todas.** Todas las Áreas usan el mismo objeto Tarea y respetan el mismo Contrato de la Tarea (03, sección 4.3). Lo que cambia entre Áreas es *qué* transiciones generan *qué* tareas; *cómo* se comporta una tarea es siempre igual.

Este patrón es la traducción práctica de "las cosas pasan y generan trabajo" sin construir un motor de eventos: cada Área conecta a mano sus estados con sus tareas, de forma legible y localizada.

Lo que una Área **nunca** hace: no construye su navegación, ni su login, ni su diseño, ni sus componentes básicos, ni su forma de mostrar listas o mensajes. Todo eso lo hereda de la shell. Una Área aporta exclusivamente su lógica de negocio —qué objeto trata y qué trabajo genera— y nada más. La lógica de negocio es el único lugar donde las Áreas pueden ser diferentes. Todo lo demás debe tender a parecerse.

En una frase: **una Área es una lista, un detalle, una acción principal y una lógica que genera tareas, todo montado sobre la shell común**. Cambian los objetos y las reglas de negocio; el esqueleto es siempre el mismo.

## 5. Principios de arquitectura

Las leyes que toda la arquitectura debe cumplir, igual que los principios de producto gobiernan el producto. Cualquier decisión técnica futura se juzga contra estas reglas. Si una decisión las incumple, la decisión está mal.

**5.1 Una única fuente de verdad.**
Cada dato existe en un solo lugar. La interfaz nunca guarda su propia copia de la información: la consulta y la modifica en la capa de datos. Si el mismo dato aparece en dos Áreas, es el mismo dato, no dos copias.

**5.2 Las Áreas nunca reinventan la shell.**
Navegación, permisos, login, diseño, componentes y comportamiento se heredan siempre de la shell. Ningún Área construye lo que la shell ya ofrece. Si un Área necesita algo que la shell no da, se valora añadirlo a la shell, no resolverlo por dentro del Área.

**5.3 Toda Área sigue el mismo patrón.**
La anatomía de la sección 4 no es una sugerencia: es el molde. Toda Área, presente o futura, se construye con la misma estructura. Esto es lo que permite que quien conoce una las conozca todas, y que la IA razone sobre cualquier Área sabiendo ya cómo está hecha.

**5.4 Cero lógica duplicada.**
Si una solución se necesita en dos sitios, se escribe una vez en el centro y se comparte (regla de la sección 3). Nunca se copia y pega lógica entre Áreas. La duplicación es el principio de la incoherencia: dos copias siempre acaban divergiendo.

**5.5 Las Áreas no dependen entre sí.**
Una Área nunca conoce la lógica interna de otra. Las Áreas solo comparten objetos comunes del modelo de datos y componentes compartidos de la shell. Si Facturas necesita un Proveedor, utiliza el objeto Proveedor; nunca llama directamente a la lógica de Stock ni de ninguna otra Área. Esto mantiene las Áreas independientes y evita dependencias ocultas: se puede cambiar una sin miedo a romper otra.

**5.6 La complejidad debe estar localizada.**
La complejidad nunca se reparte por toda la plataforma. Si una regla es compleja, vive en un único sitio, y el resto del sistema solo conoce su resultado, no su interior. No queremos inteligencia repartida por veinte Áreas distintas: queremos saber siempre dónde vive cada decisión importante. Localizar la complejidad es lo que permite cambiarla sin miedo, porque solo hay un sitio que tocar.

**5.7 Componentes reutilizables.**
Todo lo visual y de comportamiento común (listas, botones, mensajes, detalles) vive como componente compartido y se reutiliza. Las Áreas los usan, no los rehacen. Un cambio en el componente compartido mejora todas las Áreas a la vez.

**5.8 Simplicidad antes que sofisticación.**
Ante dos soluciones que funcionan, se elige la más simple de entender y mantener, aunque la otra sea técnicamente más elegante. La sofisticación que no es imprescindible es deuda disfrazada.

**5.9 Lo estándar gana siempre.**
Entre lo popular y bien documentado y lo exótico pero "mejor", se elige lo estándar. No por conservadurismo, sino porque lo estándar es lo que la IA conoce y lo que se puede mantener durante años sin un equipo de ingeniería. Esta regla es la traducción técnica directa del principio 10.

**5.10 La arquitectura se optimiza para el mantenedor, no para la máquina.**
La medida del éxito no es que sea rápida o ingeniosa: es que una persona con ayuda de IA pueda entenderla y arreglarla un martes cualquiera. El tiempo del mantenedor es el recurso más escaso del proyecto. Cualquier decisión que haga la arquitectura más difícil de entender es sospechosa de estar equivocada, por muy buena que parezca en otros aspectos.

---

Si los principios de producto responden **qué** construimos, los principios de arquitectura responden **cómo** conseguimos que siga siendo sencillo cuando el producto crezca.

---

*Fin del bloque 4-5, cerrado y validado.*

---

## 6. Cómo se crea una Área nueva

La guía repetible: cómo se añade una habitación a la casa siguiendo el contrato. Es el procedimiento que permite crecer con ayuda de IA sin entender todo el sistema, porque cada Área nueva se hace igual que la anterior. No es código: es la secuencia de pasos conceptuales.

1. **Definir el objeto o los objetos.** Qué cosa trata esta Área (Facturas → Factura). Si el objeto ya existe en el modelo de datos, se reutiliza; si es nuevo, se añade siguiendo las reglas comunes del modelo de datos (identidad, archivado, autoría). Un objeto nuevo nunca duplica uno existente.

2. **Definir los permisos.** Qué roles ven el Área y con qué acciones (ver, crear, editar, aprobar, archivar). Sin esto, el Área no se despliega (regla de 04-ROLES). Por defecto, sin acceso hasta que se conceda.

3. **Montar la anatomía estándar.** Sobre la shell, se colocan las partes del contrato: la lista, el detalle, la acción principal, las acciones sobre elemento. Se reutilizan los componentes compartidos; no se rehace ninguno.

4. **Escribir la lógica de negocio propia.** Lo único verdaderamente específico del Área: qué reglas tiene y qué tareas genera cuando ocurre algo. Aquí, y solo aquí, el Área es diferente de las demás.

5. **Conectar con las tareas.** Definir qué hechos del Área generan qué tareas y para quién, de modo que el trabajo llegue al Hoy de la persona adecuada.

El orden importa: primero el dato, luego quién accede, luego la forma estándar, y al final lo propio. Si un paso se salta, el Área queda mal encajada. Siguiendo estos cinco pasos, la Área número veinte se construye igual que la primera.

## 7. Cómo fluye una acción

El recorrido de una acción típica de principio a fin, en términos de arquitectura. Ilustra el "flujo único" en la práctica. Sin código, solo qué capa hace qué.

Ejemplo, una factura que llega:

1. **Ocurre un hecho.** Llega una factura (la sube una persona, o entra por un canal automático). El hecho se registra en la capa de datos: se crea el objeto Factura en estado inicial.
2. **Se comprueban los permisos.** Antes de ejecutar cualquier acción, el sistema valida que el usuario tiene permiso para hacerla, según su rol. Los permisos no son un añadido posterior: son un paso del flujo que siempre ocurre antes de que la lógica actúe. Una acción sin permiso no llega a ejecutarse.
3. **La lógica del Área decide.** El Área de Facturas, según sus reglas, determina qué trabajo genera ese hecho: hay que revisarla. Crea una Tarea dirigida a la persona adecuada.
4. **Los datos se actualizan.** La Tarea y la Factura quedan guardadas en la única fuente de verdad.
5. **La interfaz lo refleja.** Esa persona ve aparecer la tarea en su Hoy. No ha tenido que ir a buscar nada: el trabajo llegó a ella.
6. **La persona actúa.** Revisa, y su acción vuelve a recorrer el mismo camino: la interfaz recoge la acción, se comprueban sus permisos, la lógica decide el siguiente paso (por ejemplo, generar la tarea de aprobación para quien corresponda), los datos se actualizan, la interfaz lo refleja.

El orden conceptual completo de toda acción es siempre: usuario → interfaz → comprobación de permisos → lógica → datos → interfaz. Todo hecho de la plataforma sigue este mismo recorrido. Cambia el objeto y la regla de negocio; el flujo es siempre idéntico. Esa es la esencia del flujo único: nunca hay dos formas de hacer lo mismo.

## 8. Cómo se despliega y se mantiene

Cómo pasa un cambio de "se escribe" a "está funcionando", y qué protege el sistema en el día a día. Es la parte que sostiene el principio 10 en la práctica.

**Publicación automática.** Un cambio, una vez hecho, se publica solo a través de la capa de alojamiento, sin administrar servidores ni procesos manuales. Se escribe la mejora y queda disponible para el equipo. Menos pasos manuales, menos errores de despliegue.

**Copias de seguridad.** La información vive en la capa de datos, que mantiene copias de seguridad de forma estándar. El historial no se pierde porque nada se borra de verdad (se archiva), y porque los datos están respaldados. Perder trabajo no debería ser posible por un descuido.

**Cuando algo se rompe un martes.** La arquitectura está pensada para que un problema se pueda localizar y arreglar con ayuda de IA: la complejidad está localizada (se sabe dónde vive cada decisión), el patrón es uniforme (un fallo en un Área se parece a cualquier otro), y el stack es estándar (la IA lo conoce). Arreglar no exige entender todo el sistema, solo la parte afectada.

**Quién mantiene.** Durante mucho tiempo, el mantenimiento lo hará una sola persona con ayuda de IA. Toda esta arquitectura existe para que eso sea suficiente. Ese es el criterio último de cada decisión técnica.

## 9. Qué NO hace esta arquitectura

Las fronteras deliberadas. Están escritas para que nadie las cruce dentro de dos años creyendo que mejora algo.

**No hay motor de eventos genérico.** Los flujos se escriben a mano dentro de cada Área. La visión de "las cosas pasan y generan trabajo" se consigue con lógica concreta y legible, no con un sistema configurable abstracto. Se reevaluará solo si aparecen muchos flujos casi idénticos (ver BACKLOG).

**No hay microservicios.** Es una sola aplicación, no muchas piezas desplegadas por separado. Para el tamaño del proyecto, un conjunto ordenado y único es más simple de mantener que una constelación de servicios.

**No hay servidor propio que administrar.** La capa de datos y la de alojamiento son gestionadas; no se mantiene infraestructura a mano. Es una categoría entera de trabajo que se elimina a propósito.

**No se almacena lo clínico.** Nada de pacientes, historia clínica, agenda o Verifactu: eso es de Organízate. La frontera del modelo de datos es también una frontera de la arquitectura.

**No se construye lo que no se necesita todavía.** No se añaden capas, abstracciones ni objetos por anticipación. Una pieza se construye cuando pagar por no tenerla ya duele, no cuando parece elegante.

## 10. Cómo debe evolucionar esta arquitectura

No cómo funciona hoy, sino cómo debe crecer. Es la protección del proyecto a tres años vista.

- **Añadir una nueva Área nunca debe obligar a modificar las existentes.** Si construir una Área nueva exige tocar otras, algo en la separación está mal. Las habitaciones se añaden, no se renegocia la casa entera.
- **Cambiar un objeto debe afectar al mínimo posible.** Como cada objeto vive en un solo sitio y las Áreas son ventanas, un cambio en un objeto se propaga de forma controlada, no en cascada por todo el sistema.
- **Cualquier persona debe entender la estructura en poco tiempo.** Si alguien nuevo —o la IA— tarda en entender cómo está montado, la arquitectura ha perdido su cualidad más importante. La comprensibilidad es una característica, no un lujo.
- **La IA debe poder ayudar a mantener el proyecto.** Cada decisión se toma pensando en si la IA podrá razonar sobre ella. Lo que la IA no entiende bien, una sola persona no podrá mantenerlo.
- **Si una decisión hace la arquitectura más difícil de entender, probablemente sea incorrecta.** Esta es la prueba final de cualquier cambio futuro. La dificultad de comprensión es la señal de alarma más fiable de que algo se está torciendo.
- **Las mejoras deben ser aditivas.** Siempre que sea posible, una mejora añade comportamiento nuevo sin modificar el existente. Cambiar menos significa romper menos: se prefiere sumar una pieza a alterar una que ya funciona.

---

*05-ARQUITECTURA — cerrado. Define cómo está pensada la casa y por qué. El código pertenece a Claude Code.*

---

La arquitectura no existe para demostrar sofisticación técnica. Existe para que una sola persona pueda construir, entender y mantener la plataforma durante años con ayuda de IA. Si una decisión mejora la tecnología pero empeora esa capacidad, probablemente sea una mala decisión.

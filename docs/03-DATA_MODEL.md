# 03 · MODELO DE DATOS

*El documento más importante y el más caro de equivocar. El código se refactoriza; los datos migrados duelen. Por eso se construye despacio y se valida sección por sección.*

*Estado: cerrado. Define qué existe, cómo se relaciona y qué información mínima guarda cada objeto. No define comportamientos ni flujos: eso es diseño de Área.*

---

## 1. Principios del modelo de datos

Las reglas que gobiernan todas las tablas. Cada objeto que definamos después se juzga contra estas reglas. Si un objeto las incumple, el objeto está mal — no la regla.

**1.1 Un objeto existe una sola vez.**
Cada cosa importante de la clínica (un proveedor, un empleado, una factura) vive en un único sitio. Las Áreas no son dueñas de la información: son ventanas que trabajan sobre ella. Si dos Áreas necesitan el mismo proveedor, miran el mismo proveedor, no una copia cada una.

**1.2 Usuario y Empleado son cosas distintas.**
Quien entra a la plataforma (Usuario) y quien se gestiona como personal de la clínica (Empleado) son dos objetos separados, aunque a veces sean la misma persona. Hay usuarios que no son empleados (una gestoría externa, un socio) y empleados que no son usuarios (alguien a quien se le gestionan vacaciones pero no usa la plataforma). Confundirlos es caro de deshacer, así que nacen separados.

**1.3 El cargo no determina los permisos.**
Una cosa es el cargo de una persona en la empresa (Director, Responsable…) y otra son sus permisos en la plataforma. El cargo pertenece al Empleado; los permisos se obtienen mediante uno o varios Roles funcionales (Administración, Podólogo, Ortopedia) y, cuando haga falta, mediante un permiso especial de Administrador del sistema con acceso completo. Un usuario puede tener varios roles a la vez. Separar cargo y permisos hace el modelo más flexible: cambiar el cargo de alguien no toca sus accesos, y al revés.

**1.4 Los objetos se dividen en maestros y operativos.**
Una distinción que ayuda a entender el modelo según crece:
- **Objetos maestros** — entidades permanentes que existen durante años: Proveedor, Producto, Empleado, Centro. Cambian poco, se consultan mucho, y muchos objetos operativos apuntan a ellos.
- **Objetos operativos** — cosas que ocurren en el día a día: Factura, Lead, Solicitud de vacaciones, Documento, Tarea. Nacen, se procesan y se archivan constantemente.

**1.5 Nada se borra: se archiva.**
Ningún objeto se elimina de verdad. Se marca como archivado y deja de aparecer. Así nunca se pierde historial, nunca se rompe una referencia (una factura que apuntaba a un proveedor archivado sigue teniendo sentido) y siempre se puede auditar qué pasó. Borrar de verdad es la excepción rarísima, no la norma.

**1.6 Todo objeto sabe quién lo creó y cuándo.**
Cada objeto lleva su rastro: cuándo se creó, cuándo se modificó por última vez y quién hizo cada cosa. En un sistema que coordina el trabajo de varias personas, saber quién hizo qué no es opcional. Los detalles concretos de estos metadatos se fijan en la sección 6.

**1.7 Los objetos se clasifican también por familia.**
Además de maestro u operativo, cada objeto pertenece a una familia según su papel:
- **Objetos de negocio** — las cosas de la clínica: Factura, Proveedor, Producto, Lead, Empleado, Documento, Solicitud de vacaciones.
- **Objetos del sistema** — lo que hace funcionar la plataforma: Usuario, Rol, Tarea.
- **Objetos de configuración** — lo que define el marco de trabajo: Centro, y ajustes generales.

**1.8 Las cosas pasan porque pasan en la empresa, no porque alguien abra un Área.**
Llega una factura, un proveedor responde, se solicitan vacaciones, baja el stock, entra un lead. Todo eso ocurre en la realidad de la clínica. La plataforma detecta que ha ocurrido un hecho, genera el trabajo correspondiente y se lo muestra a la persona adecuada en Hoy. Esta es la razón de fondo de por qué la Tarea es el objeto central y por qué Hoy existe: no organizamos pantallas, transformamos hechos en trabajo.

**1.9 La frontera con Organízate es sagrada.**
En esta base de datos NO viven datos clínicos: ni pacientes, ni historia clínica, ni agenda, ni facturación clínica, ni Verifactu, ni consentimientos. Todo eso es de Organízate. Si algún dato clínico necesita reflejarse aquí, se guarda la mínima referencia imprescindible (por ejemplo, un identificador o un dato agregado), nunca el dato sensible completo. Ante la duda, no entra.

---

## 2. Diccionario de objetos

Todos los objetos globales de la plataforma, con su familia, su tipo (maestro u operativo) y una frase de qué son. Es el índice: el bosque antes que los árboles. Todavía sin campos ni detalle.

**Objetos del sistema**

- **Usuario** *(maestro)* — quien entra a la plataforma. Tiene credenciales de acceso y uno o varios roles. Es la identidad con la que se trabaja.
- **Rol** *(maestro)* — el tipo funcional de usuario (Administración, Podólogo, Ortopedia). Define qué Áreas ve y qué puede hacer. Un usuario puede tener varios. Aparte de los roles funcionales existe un permiso especial de **Administrador del sistema**, con acceso completo. Sin ningún rol, un usuario no puede hacer nada.
- **Tarea** *(operativo)* — una unidad de trabajo asignada a un usuario. Es el corazón del sistema: todo lo que pasa termina generando tareas, y Hoy es el conjunto de tareas abiertas de cada persona.

**Objetos de negocio**

- **Empleado** *(maestro)* — una persona que trabaja en la clínica, gestionada como personal (datos laborales, cargo, vacaciones, documentación). Puede o no ser también un Usuario.
- **Proveedor** *(maestro)* — una empresa o persona a la que se le compra o que factura a la clínica. Compartido por Facturas y Stock.
- **Producto** *(maestro)* — un artículo que la clínica almacena o utiliza. El objeto central del Área de Stock.
- **Factura** *(operativo)* — un documento de cobro recibido, con su proveedor, importe e impuestos. El objeto central del Área de Facturas.
- **Lead** *(operativo)* — un posible paciente que ha mostrado interés y todavía no es paciente. El objeto central del Área de Leads.
- **Solicitud de vacaciones** *(operativo)* — una petición de ausencia de un empleado, con sus fechas y su estado de aprobación. El objeto central del Área de Vacaciones.
- **Documento** *(operativo)* — un archivo adjunto (un PDF de factura, un contrato, un justificante) asociado a otro objeto.

**Objetos de configuración**

- **Centro** *(maestro)* — una sede física de la clínica. Hoy probablemente una sola, pero el modelo nace preparado para varias. Muchos objetos pueden pertenecer a un centro.

*Nota: esta lista es el punto de partida, no una lista cerrada para siempre. Nuevos objetos podrán añadirse siguiendo los principios de la sección 1. Pero los que están aquí son los cimientos. No se introducen objetos por anticipación: solo entran cuando hay un caso real que los justifique.*

---

## 3. Relaciones entre objetos

El mapa mental de cómo se conecta todo, en lenguaje humano. Esta es la sección que más barato es corregir ahora y más cara después. Sin tablas, sin campos: solo cómo se relacionan las cosas.

**En torno al Usuario y el trabajo**

- Un **Usuario** tiene uno o varios **Roles**. El rol es lo que decide qué ve y qué puede hacer.
- Un **Usuario** puede tener muchas **Tareas** asignadas. Una tarea pertenece siempre a un usuario (quien debe hacerla).
- Una **Tarea** puede apuntar a cualquier otro objeto: la tarea "revisar factura" apunta a una Factura; "aprobar vacaciones" apunta a una Solicitud de vacaciones. La tarea es el trabajo; el objeto al que apunta es sobre qué se trabaja. Una tarea también puede existir sin apuntar a nada (una tarea suelta creada a mano).

**La relación Usuario ↔ Empleado**

- Un **Empleado** puede estar vinculado a un **Usuario**, pero no siempre. Un empleado que usa la plataforma tiene usuario; uno al que solo se le gestionan las vacaciones, no. Y un usuario externo (gestoría) no tiene empleado. Son dos objetos que a veces se dan la mano, nunca el mismo.

**En torno a las Facturas y las compras**

- Una **Factura** pertenece a un **Proveedor**.
- Una **Factura** puede tener uno o varios **Documentos** asociados (el PDF original, por ejemplo).
- Un **Producto** puede comprarse a varios **Proveedores** distintos. Normalmente hay uno habitual, pero el modelo nunca asume que solo existe uno: la relación entre Producto y Proveedor es de muchos a muchos desde el principio.
- Tanto Facturas como Stock miran a los **mismos** Proveedores: no hay dos listas de proveedores.

**En torno a las personas de la clínica**

- Un **Empleado** puede tener muchas **Solicitudes de vacaciones**.
- Un **Empleado** puede tener muchos **Documentos** asociados (contrato, nóminas, justificantes).

**En torno a los Centros**

- Un **Centro** puede tener muchos **Empleados**, muchos **Productos** y, en general, muchos objetos de negocio asociados.
- Un objeto de negocio pertenece como mucho a un **Centro**. Mientras haya una sola sede, esta relación existe pero casi no se nota; el día que haya varias, ya está preparada.

**Los Documentos como pieza transversal**

- Un **Documento** siempre está asociado a otro objeto (una Factura, un Empleado, un Lead…). No existe un documento suelto sin dueño. Es la forma en que cualquier objeto puede llevar archivos adjuntos sin que cada uno invente su propia manera.

**La regla general de las relaciones**

Los objetos de negocio y de configuración se conectan entre sí formando la información de la clínica. Las **Tareas** se superponen a todo ese mapa: son la capa de trabajo que puede señalar a cualquier objeto y decir "aquí hay algo que hacer, y es de tal persona". Por eso la Tarea es el objeto que une el mundo de los datos con el mundo de las personas.

---

*Fin del bloque 1-2-3, cerrado y validado.*

---

## 4. Objetos fundacionales en detalle

Los tres objetos raíz de los que cuelga todo lo demás: Usuario, Rol y Tarea. Se describen por "qué información guardan y por qué", sin tecnología de base de datos. La traducción técnica exacta vive en 05-ARCHITECTURE.

Todos ellos heredan además los metadatos comunes (identificador, fechas, autoría, archivado) que se fijan en la sección 6, así que aquí no se repiten.

### 4.1 Usuario

Quien entra a la plataforma. Es la identidad con la que se trabaja.

Qué guarda y por qué:
- **Nombre** — para mostrar de quién es cada cosa ("asignado a Sara") y saludar en Hoy.
- **Correo electrónico** — es su identificador de acceso. Único: no hay dos usuarios con el mismo correo.
- **Estado (activo / inactivo)** — un usuario que deja la clínica se desactiva, no se borra (principio de archivar). Un usuario inactivo no puede entrar, pero su rastro en tareas y objetos antiguos se conserva.
- **Vínculo opcional a un Empleado** — si este usuario es además personal de la clínica, apunta a su ficha de Empleado. Puede estar vacío (una gestoría externa es usuario pero no empleado).
- Sus **Roles** — que definen qué ve y qué puede hacer. Se detalla en la relación de abajo.

Lo que NO guarda:
- La contraseña en sí. La gestión de credenciales (contraseñas, recuperación, sesión) la lleva el sistema de autenticación estándar, no una tabla nuestra. Nosotros guardamos quién es el usuario, no cómo se autentica.
- El cargo. El cargo (Director, Responsable) vive en Empleado, no aquí. Usuario es identidad y acceso; nunca jerarquía de empresa.

### 4.2 Rol

El tipo funcional de usuario. Es lo que decide qué Áreas ve y qué puede hacer dentro de ellas.

Qué guarda y por qué:
- **Nombre del rol** — Administración, Podólogo, Ortopedia, Marketing, RRHH, Administrador del sistema…
- **Qué Áreas puede ver** — la lista de Áreas visibles para ese rol. Es lo que hace posible la ocultación total (principio 5): un Podólogo no ve el Área de Facturas porque su rol no la incluye.
- **Qué puede hacer dentro de cada Área** — el rol define no solo qué Áreas se ven, sino qué acciones se permiten dentro de cada una: ver, crear, editar, aprobar, eliminar (archivar). Un rol puede, por ejemplo, ver y crear facturas pero no aprobarlas. Es un único mecanismo de permisos —Área + acciones— para toda la plataforma, sin sistemas paralelos.

Reglas del rol:
- Un **Usuario** puede tener **uno o varios** roles. Sus permisos son la suma de todos ellos: si un rol le da acceso a Facturas y otro a Leads, ve las dos.
- **Administrador del sistema** es un rol más, no un mecanismo aparte: simplemente tiene todas las acciones activadas en todas las Áreas. Quien lo tiene, acceso completo. Es la única "regla especial", y se resuelve dentro del mismo mecanismo de roles: un solo sistema de permisos en toda la plataforma.
- Los roles son un **objeto maestro**: existen pocos, cambian poco, y muchos usuarios apuntan a ellos.

### 4.3 Tarea

El corazón del sistema. Una unidad de trabajo para una persona. Todo lo que pasa en la clínica termina generando tareas, y Hoy es, simplemente, las tareas abiertas de cada uno.

Qué guarda y por qué:
- **Título** — qué hay que hacer, en lenguaje humano ("Revisar factura de Proveedor X").
- **Descripción opcional** — detalle adicional si hace falta.
- **A quién está asignada** — el Usuario responsable. Toda tarea pertenece a alguien; ese "alguien" es quien la ve en su Hoy.
- **Estado (abierta / hecha)** — deliberadamente simple. Una tarea está pendiente o está resuelta. Si con el uso real aparece la necesidad de más estados (en curso, bloqueada), se añaden entonces, no por anticipación.
- **A qué objeto apunta (opcional)** — la tarea "revisar factura" apunta a una Factura; "aprobar vacaciones" apunta a una Solicitud de vacaciones. Este vínculo es lo que convierte la tarea en algo accionable: desde Hoy, pulsas y vas directo al objeto sobre el que trabajar. Una tarea también puede no apuntar a nada (una tarea suelta creada a mano).
- **Origen** — qué generó la tarea: creada a mano por una persona, o disparada por un hecho de un Área (llegó una factura, bajó el stock). Saber el origen ayuda a entender de dónde viene el trabajo.
- **Fecha límite opcional** — si la tarea tiene un plazo, para poder ordenar Hoy por lo más urgente.

Por qué la Tarea es tan simple a propósito:
- Es el objeto que más se crea y más se consulta en toda la plataforma. Cuanto más simple, más rápido y más fácil de mantener. Resistimos la tentación de enriquecerla hasta que el uso real lo pida (ver "Actividad" en BACKLOG). Un título, un dueño, un estado y un vínculo opcional: con eso funciona Hoy entero.

Cómo la Tarea conecta el sistema:
- La Tarea se superpone a todos los demás objetos. Cualquier Área puede crear tareas apuntando a sus objetos. Todas las tareas de una persona, vengan del Área que vengan, se juntan en su Hoy. Por eso la Tarea es lo que une el mundo de los datos (Facturas, Leads, Productos) con el mundo de las personas (quién hace qué hoy).

**Contrato de la Tarea.** El ciclo de vida común que toda Área respeta al trabajar con tareas. No es un motor de workflow: es el conjunto de reglas fijas que evita que cada Área invente su propia mecánica.

- **Quién la crea:** la lógica del Área. Una tarea nace porque un Área, según sus reglas de negocio, determina que un hecho genera trabajo. El sistema no crea tareas por su cuenta; siempre hay un Área detrás. Una persona también puede crear una tarea suelta a mano (origen manual).
- **Quién la completa:** el usuario al que está asignada, o un usuario con permiso sobre ella. Completar es marcar Hecha.
- **Cuándo se completa automáticamente:** cuando la acción que la motivaba se realiza por otra vía. Si una tarea pide "aprobar la factura X" y la factura X se aprueba desde su detalle, el Área marca esa tarea como Hecha automáticamente. La regla: si el trabajo ya está hecho, la tarea no debe seguir abierta pidiéndolo. Es responsabilidad del Área cerrar sus propias tareas cuando su objeto alcanza el estado que las satisface.
- **Qué ocurre si el objeto origen se archiva o desaparece:** la tarea asociada se cancela (pasa a un estado terminal distinto de Hecha, o se archiva ella también). Una tarea nunca queda "huérfana" apuntando a algo que ya no existe ni exige un trabajo que ya no tiene sentido. Es responsabilidad del Área que archiva el objeto ocuparse de sus tareas dependientes.
- **Si puede reabrirse:** una tarea completada no se reabre. Si el trabajo vuelve a ser necesario, se crea una tarea nueva. Esto mantiene el historial limpio (qué se hizo y cuándo) y evita estados ambiguos. Coherente con "nada se borra, se archiva": una tarea Hecha es un registro de que ese trabajo se hizo.
- **Reparto de responsabilidad Área / sistema:** el **sistema** aporta el objeto Tarea, su asignación a un usuario, su estado (Abierta/Hecha), su aparición en Hoy y su archivado. El **Área** decide cuándo crear una tarea, cuándo darla por completada automáticamente y cuándo cancelarla al archivar su objeto. El sistema ofrece el recipiente y su comportamiento común; el Área pone la lógica de cuándo. Esta frontera es la que permite que Hoy funcione igual para todas las Áreas sin que ninguna reinvente la Tarea.

---

*Fin de la sección 4, cerrada y validada.*

---

## 5. Objetos de negocio en detalle

El grueso del modelo. Cada objeto con "qué guarda y por qué". Todos heredan los metadatos comunes de la sección 6 (identificador, fechas, autoría, archivado), que no se repiten aquí. Todos pueden pertenecer a un Centro (relación de la sección 3).

### 5.1 Proveedor *(maestro)*

Una empresa o persona a la que se compra o que factura a la clínica. Compartido por Facturas y Stock: existe una sola vez.

Qué guarda y por qué:
- **Nombre / razón social** — cómo se identifica.
- **CIF/NIF** — identificación fiscal, necesaria para facturas y gestoría.
- **Datos de contacto** — correo, teléfono, dirección: para comunicarse y para pedidos.
- **Notas opcionales** — cualquier detalle útil (condiciones, persona de contacto).
- **Estado (activo / archivado)** — un proveedor con el que se deja de trabajar se archiva; sus facturas antiguas siguen teniendo sentido.

### 5.2 Producto *(maestro)*

Un artículo que la clínica almacena o utiliza. Objeto central del Área de Stock.

Qué guarda y por qué:
- **Nombre** — cómo se identifica el artículo.
- **Referencia/código opcional** — para identificarlo sin ambigüedad.
- **Unidad de medida** — unidades, cajas, pares… para contar bien.
- **Stock actual** — cuántas unidades hay. Es el dato que dispara el trabajo cuando baja del mínimo.
- **Stock mínimo** — el umbral por debajo del cual se genera una tarea de compra. Es lo que convierte "baja el stock" en trabajo concreto.
- **Proveedores a los que se compra** — uno o varios (relación de muchos a muchos de la sección 3). Normalmente hay uno habitual, pero no se asume que solo exista uno.
- **Estado (activo / archivado)**.

### 5.3 Factura *(operativo)*

Un documento de cobro recibido. Objeto central del Área de Facturas.

Qué guarda y por qué:
- **Proveedor** — a quién corresponde (relación de la sección 3).
- **Número de factura** — el que trae el documento original.
- **Fecha de la factura** — cuándo se emitió.
- **Importe** — base, impuestos (IVA) y total. Separados, porque la gestoría los necesita así.
- **Estado** — una factura atraviesa varios estados hasta quedar finalizada (desde que se recibe hasta que se archiva). El recorrido exacto NO se fija aquí: es comportamiento, y se define al diseñar el Área de Facturas, a partir del trabajo real observado. El modelo solo asume que existe un estado.
- **Documento(s) asociado(s)** — el PDF original y cualquier adjunto (relación con Documento).
- **Notas opcionales**.

### 5.4 Empleado *(maestro)*

Una persona que trabaja en la clínica, gestionada como personal. Puede o no ser también un Usuario.

Qué guarda y por qué:
- **Nombre completo** — identificación.
- **Cargo** — Director, Responsable, Podólogo, Recepción… Aquí vive el cargo, separado de los permisos (que son del Usuario y sus Roles). Cambiar el cargo no toca los accesos.
- **Datos de contacto** — teléfono, correo personal.
- **Datos laborales básicos** — fecha de alta, tipo de contrato… lo mínimo necesario para RRHH y Vacaciones. Sin excesos: nada de datos sensibles que no hagan falta.
- **Vínculo opcional a un Usuario** — si esta persona usa la plataforma, apunta a su cuenta. Puede estar vacío.
- **Centro al que pertenece**.
- **Estado (activo / archivado)** — quien deja la clínica se archiva; su historial (vacaciones pasadas, documentos) se conserva.

### 5.5 Lead *(operativo)*

Un posible paciente que ha mostrado interés y todavía no es paciente. Objeto central del Área de Leads.

Qué guarda y por qué:
- **Nombre** — de quién se trata.
- **Datos de contacto** — teléfono, correo: para poder responderle.
- **Origen** — de dónde vino (campaña, recomendación, web…). Clave para marketing.
- **Tratamiento de interés** — qué busca, para cualificar.
- **Estado** — dónde está en el embudo: nuevo, contactado, cualificado, convertido, descartado.
- **Notas opcionales** — contexto de la conversación.

Frontera con Organízate: cuando un lead se convierte en paciente, la gestión pasa a Organízate. El Lead guarda como mucho la referencia de que se convirtió, nunca datos clínicos (principio 1.9).

### 5.6 Solicitud de vacaciones *(operativo)*

Una petición de ausencia de un empleado. Objeto central del Área de Vacaciones.

Qué guarda y por qué:
- **Empleado** — quién la solicita (relación de la sección 3).
- **Fechas** — inicio y fin de la ausencia.
- **Tipo** — vacaciones, asuntos propios, baja… si hace falta distinguir.
- **Estado** — pendiente, aprobada, rechazada. El estado dispara el trabajo: una solicitud pendiente genera una tarea de aprobación para quien corresponda.
- **Motivo/notas opcionales**.

### 5.7 Documento *(operativo)*

Un archivo adjunto asociado a otro objeto. La forma común en que cualquier objeto lleva archivos, sin que cada Área invente la suya.

Qué guarda y por qué:
- **El archivo en sí** — el fichero (PDF, imagen…). El almacenamiento del fichero lo lleva el sistema de archivos estándar; el objeto Documento guarda la referencia y sus datos.
- **Nombre** — cómo se llama, para reconocerlo.
- **Tipo** — factura, contrato, justificante… para clasificar.
- **A qué objeto pertenece** — siempre tiene dueño (una Factura, un Empleado, un Lead). No existe documento suelto (relación de la sección 3).

### 5.8 Centro *(maestro, configuración)*

Una sede física de la clínica. Hoy probablemente una sola, pero el modelo nace preparado para varias.

Qué guarda y por qué:
- **Nombre** — cómo se identifica la sede.
- **Dirección y contacto** — dónde está.
- **Estado (activo / archivado)**.

Mientras haya una sola sede, este objeto existe pero apenas se nota: todos los objetos apuntan al mismo centro. El día que haya una segunda, la separación ya está hecha y no hay que migrar nada.

---

*Fin de la sección 5, cerrada y validada.*

---

## 6. Reglas comunes de todos los objetos

Las convenciones que hereda cualquier objeto de la plataforma, presente o futuro. No es una lista técnica de campos: son las reglas que cualquier objeto nuevo debe seguir dentro de dos años sin tener que reinventarlas. Si un objeto nuevo respeta esta sección, encaja en el sistema; si no, está mal diseñado.

**Qué objetos pueden archivarse.**
Todos. Ningún objeto se borra de verdad: se archiva. Archivar significa que deja de aparecer en las vistas normales, pero se conserva para siempre y no rompe ninguna referencia que apunte a él. El borrado real es una excepción rarísima reservada a casos concretos (por ejemplo, un dato metido por error o una obligación legal de eliminación), nunca la forma normal de quitar algo de en medio.

**Quién registra la autoría.**
Todo objeto sabe quién lo creó y quién lo modificó por última vez, y cuándo. Esa autoría la registra el sistema automáticamente a partir del usuario que realiza la acción; no depende de que nadie la rellene a mano. En una plataforma que coordina el trabajo de varias personas, poder responder "¿quién hizo esto y cuándo?" es obligatorio, no opcional.

**Cómo se auditan los cambios.**
Como mínimo, todo objeto conserva su fecha de creación, su fecha de última modificación y quién hizo cada una. Para los objetos donde el historial importa de verdad (por ejemplo, cambios de estado en una Factura o una aprobación de Vacaciones), el registro de qué cambió y cuándo se diseña al construir esa Área. La regla general: nunca se pierde el rastro de que algo ocurrió; el nivel de detalle se ajusta a cada Área.

**Cómo se identifican los objetos.**
Cada objeto tiene un identificador propio, único y estable, que nunca cambia durante toda su vida y que no reutiliza el de otro. Ese identificador es interno: es como el sistema se refiere al objeto, no lo que ve el usuario. El usuario reconoce los objetos por su nombre o por datos con sentido (el número de una factura, el nombre de un proveedor), nunca por su identificador interno.

**Cómo se nombran los objetos y sus tipos.**
Los nombres de los objetos son en singular y describen una cosa (Factura, Proveedor, Empleado), no una pantalla ni una acción. Un objeto es algo que existe; un Área es dónde se trabaja con él; una Tarea es el trabajo. No se mezclan: nunca un objeto se llama como un Área ni al revés. Esta coherencia es lo que permite que, dentro de años, cualquiera —persona o IA— entienda el modelo sin traducción.

**Toda pertenencia a un objeto archivado sigue siendo válida.**
Si un objeto apunta a otro que luego se archiva (una Factura cuyo Proveedor se archivó), la referencia se conserva y sigue teniendo sentido. Archivar nunca deja "huérfano" a quien apuntaba. Por eso se archiva en vez de borrar.

**Todo objeto puede pertenecer a un Centro.**
Mientras haya una sola sede, esta pertenencia es casi invisible, pero existe desde el principio para que el paso a multi-centro no obligue a rehacer nada.

**La frontera con Organízate aplica a todos.**
Ningún objeto de la plataforma almacena datos clínicos sensibles. Si un objeto necesita relacionarse con algo clínico, guarda la mínima referencia imprescindible, nunca el dato completo. Esta regla está por encima de cualquier conveniencia.

---

## Cierre del documento

Este modelo define **qué existe** en la plataforma, **cómo se relaciona** cada cosa con las demás y **qué información mínima** guarda cada objeto. No define comportamientos, flujos de trabajo ni estados detallados: eso pertenece al diseño de cada Área.

Los cimientos que este documento fija y que son caros de cambiar más adelante: la separación Usuario / Empleado, la Tarea como objeto central que conecta datos y personas, los objetos globales que existen una sola vez, un único mecanismo de permisos por Roles, y las reglas comunes de archivado, autoría e identidad. Sobre esta base puede crecer toda la plataforma durante años.

*03-DATA_MODEL.md — cerrado. No se reabre salvo necesidad real durante la construcción.*

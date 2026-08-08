# 02 · PRODUCTO

*El documento que cualquier persona nueva debería leer primero para entender qué es la plataforma, antes incluso de hablar de arquitectura. No es técnico. Explica qué es, qué problema resuelve, cómo se relacionan las piezas y qué experiencia buscamos.*

---

## Qué es

Una plataforma interna donde vive todo el trabajo de la clínica que Organízate no gestiona. No es un conjunto de herramientas: es una sola casa con habitaciones (Áreas), todas con la misma puerta, el mismo diseño y la misma forma de trabajar.

El usuario entra una vez. A partir de ahí, todo funciona igual mire donde mire. Desde ese momento, nunca vuelve a preguntarse dónde tiene que hacer cada cosa. La plataforma se lo muestra de forma natural. Aprender un Área es aprenderlas todas.

## Qué problema resuelve

Hoy la clínica trabaja con herramientas sueltas que no se hablan entre sí: Organízate para lo clínico, más correo, WhatsApp, Excel, Drive y varias herramientas internas construidas por separado. La información se copia a mano de un sitio a otro, cada herramienta tiene su propia lógica, y nadie tiene un único lugar donde ver qué le toca hacer.

La plataforma resuelve tres cosas concretas: **centraliza** la información para que exista una sola vez, **coordina** el trabajo para que cada persona sepa qué hacer, y **elimina** tareas repetitivas para que el equipo piense más y copie menos.

## Qué NO es

No es un sustituto de Organízate. Organízate sigue siendo el software clínico (pacientes, agenda, historia clínica, facturación clínica, Verifactu, consentimiento). La plataforma es una capa complementaria de operaciones internas. No hace historia clínica, ni agenda, ni facturación clínica, ni Verifactu, y no almacena datos clínicos sensibles sin necesidad real.

## Las tres piezas del producto

Todo el producto se entiende con tres conceptos. Nada más.

**Hoy** — el centro operativo. Lo primero que ve cada persona al entrar. Un feed con el trabajo que le corresponde: cosas que revisar, aprobar, contestar o completar. No es un panel de métricas; es una lista de trabajo que viene hacia ti. Cuando Hoy está vacío, has terminado.

**Áreas** — las habitaciones de la casa. Cada una resuelve un asunto concreto (Facturas, Stock, Leads…). Todas tienen la misma anatomía: una vista principal con una lista, la posibilidad de buscar y filtrar, el detalle de un elemento, y una acción principal clara. Un usuario solo ve las Áreas que le corresponden por su rol.

**Objetos** — las cosas importantes de la clínica (un proveedor, un empleado, una factura, un producto). Existen una sola vez en el centro, y las Áreas son ventanas que los miran desde ángulos distintos. El mismo proveedor se ve igual desde Facturas y desde Stock, porque es el mismo. Las Áreas no son propietarias de la información. Son la forma en la que las personas trabajan sobre esa información.

## Cómo se relaciona todo

La lógica del producto es una cadena simple:

**Pasa algo → se genera una Tarea → aparece en el Hoy de alguien → esa persona la resuelve.**

Una factura llega, un proveedor responde, un empleado pide vacaciones, un stock baja del mínimo. Cada uno de esos acontecimientos se transforma en trabajo concreto para una persona concreta. Las Áreas son donde ese trabajo se hace; Hoy es donde cada persona lo encuentra; los Objetos son la información sobre la que se trabaja.

La Tarea es lo que une las tres piezas. Cualquier Área puede crear tareas, y todas las tareas de una persona —vengan del Área que vengan— se juntan en su Hoy.

## Áreas de la plataforma

La casa que iremos construyendo habitación por habitación. No se construyen todas a la vez: cada una llega cuando de verdad hace falta.

**Núcleo del sistema**
- **Hoy** — el centro operativo. La puerta de entrada de cada persona.
- **Ajustes** — usuarios, roles, configuración de la cuenta.

**Áreas existentes** (ya funcionan como herramienta; se migrarán a la plataforma)
- **Facturas** — recepción, revisión y aprobación de facturas.
- **Stock** — control de existencias y compras.
- **Leads** — captación y cualificación de posibles pacientes.
- **Vacaciones** — solicitudes y aprobación de ausencias del equipo.
- **Dashboard** — indicadores generales de la clínica.

**Áreas previstas** (el mapa a largo plazo)
- **RRHH** — gestión de empleados y documentación laboral.
- **Protocolos** — procedimientos internos de la clínica.
- **Marketing** — campañas y seguimiento de captación.
- **Indicadores** — métricas de negocio más allá del Dashboard.
- **Centros** — gestión de sedes, si la clínica crece a varias.

## La IA en el producto

La IA no es un Área. Es un comportamiento presente allí donde aporta valor: resumir un documento, leer una factura en PDF, redactar un borrador, detectar una anomalía, buscar información. El usuario nunca "va a la IA": la plataforma es inteligente allí donde trabaja. Y cada automatización elimina trabajo, nunca criterio — las decisiones importantes siguen siendo de las personas.

## La experiencia que buscamos

Una plataforma silenciosa y ordenada que te dice lo justo, cuando lo necesitas, y se aparta el resto del tiempo. Ni te abruma con datos ni te hace buscar. Entras, ves lo tuyo, lo resuelves, te vas a trabajar.

Cinco principios de experiencia guían cada pantalla: **claridad** sobre densidad (ante la duda, no se muestra); **propósito** en cada pantalla (siempre sabes qué se espera que hagas aquí); **consistencia** absoluta (lo mismo se ve y se comporta igual en todas partes); **lenguaje humano** (nada de jerga técnica en la interfaz); y **revisión humana visible** (cuando algo lo hace una automatización, se ve, y aprobar es un momento de diseño, no una casilla escondida).

## Cómo crecerá la plataforma

La plataforma nunca crecerá creando Áreas nuevas sin criterio.

Solo aparecerá una nueva Área cuando:

- exista un problema repetitivo claramente identificado;
- no encaje en ninguna Área existente;
- aporte una mejora real al trabajo diario;
- pueda mantenerse con la misma simplicidad que el resto de la plataforma.

Si una necesidad puede resolverse ampliando un Área existente, siempre se priorizará esa opción.

## En una frase

No estamos construyendo software que resuelve funciones. Estamos construyendo el sistema operativo desde el que trabaja la clínica cada día.

---

*Podología y Biomecánica Rivas · Fase de diseño, antes de la primera línea de código.*

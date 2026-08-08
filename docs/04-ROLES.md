# 04 · ROLES Y PERMISOS

*Define quién accede a qué y con qué acciones. No define los flujos internos de cada Área (eso es diseño de Área). Se apoya en el modelo de datos: Usuario, Rol y el mecanismo de permisos ya fijados en 03-DATA_MODEL, sección 4.*

---

## 1. Cómo funcionan los permisos

Un único mecanismo en toda la plataforma, sin sistemas paralelos:

- Los permisos se obtienen mediante **Roles**. Un Usuario puede tener **uno o varios**.
- Un Rol define **tres cosas**: **qué Áreas ve**, **qué acciones** puede hacer dentro de cada una, y **con qué ámbito**.
- Las acciones posibles son: **ver, crear, editar, aprobar, eliminar** (eliminar = archivar).
- El **ámbito** de una acción es **todo** o **solo lo propio**. "Todo" permite actuar sobre cualquier elemento del Área; "solo lo propio" limita la acción a los elementos que pertenecen al usuario (sus vacaciones, sus tareas). El ámbito es lo que permite que un rol acceda a un Área viendo únicamente lo suyo, sin necesidad de un mecanismo aparte. Por defecto, cuando no se especifica, el ámbito de un permiso es "todo".
- Los permisos de un usuario son la **suma** de sus roles. Si un rol da acceso a Facturas y otro a Leads, ve ambas.
- El **cargo** de la persona (Director, Responsable…) vive en el objeto Empleado y **no** otorga permisos. Cargo y permisos son cosas separadas.

## 2. Ocultación total

El principio 5 en la práctica: cada usuario solo ve lo que su rol permite.

- Un Área para la que no tienes permiso **no aparece**: ni en la navegación, ni en buscadores, ni como botón deshabilitado. Sencillamente no existe para ti.
- No es que se te niegue el acceso: es que no llegas a saber que está ahí. Un Podólogo nunca ve el Área de Facturas, así que nunca se pregunta qué hace.
- Lo mismo aplica a las acciones dentro de un Área: si tu rol puede ver facturas pero no aprobarlas, el botón de aprobar no aparece para ti.
- La ocultación es visual y real: no mostrar algo va siempre acompañado de impedirlo por debajo. Nunca se esconde un botón dejando la acción accesible por otro camino.

## 3. Los roles de la v1

Los roles funcionales iniciales. La lista puede crecer (Marketing, RRHH… tendrán el suyo cuando se construyan sus Áreas), pero estos son los de arranque:

- **Administrador del sistema** — un rol más, con todas las acciones activadas en todas las Áreas. Acceso completo a toda la plataforma.
- **Administración** — el rol operativo del día a día de gestión: facturas, stock, leads, vacaciones.
- **Podólogo** — el rol clínico-asistencial. Ve lo que le concierne de su trabajo, no la gestión administrativa.
- **Ortopedia** — similar a Podólogo, en su ámbito.

Nota: una persona puede acumular varios roles. La asignación de usuarios concretos a roles pertenece a la configuración del sistema, no a esta documentación.

## 4. Matriz inicial de permisos

Qué ve y qué puede hacer cada rol por Área. Las Áreas aún no construidas no definen permisos por adelantado: se definirán cuando se diseñe el Área.

Leyenda: **— sin acceso** · **Ver** · **Crear/Editar** · **Aprobar** · **Todo** (incluye archivar)

| Área | Admin. del sistema | Administración | Podólogo | Ortopedia |
|------|--------------------|----------------|----------|-----------|
| **Hoy** | Todo | Ver (sus tareas) | Ver (sus tareas) | Ver (sus tareas) |
| **Facturas** | Todo | Ver + Crear/Editar + Aprobar | — | — |
| **Stock** | Todo | Ver + Crear/Editar | Ver + Crear/Editar | Ver + Crear/Editar |
| **Leads** | Todo | Ver + Crear/Editar | Ver + Crear/Editar | Ver + Crear/Editar |
| **Vacaciones** | Todo | Ver + Crear/Editar (las suyas) | Crear (las suyas) | Crear (las suyas) |
| **Dashboard** | Todo | Ver | — | — |
| **Ajustes** | Todo (gestión de usuarios y roles) | — | — | — |
| *RRHH (futura)* | — | — | — | — |
| *Protocolos (futura)* | — | — | — | — |
| *Marketing (futura)* | — | — | — | — |
| *Indicadores (futura)* | — | — | — | — |

Notas de la matriz:
- Las Áreas futuras (RRHH, Protocolos, Marketing, Indicadores) se dejan sin permisos: se documentarán en su propio documento cuando se diseñen.
- **Vacaciones y ámbito:** cuando la matriz indica "las suyas", el permiso tiene ámbito "solo lo propio": el rol accede al Área de Vacaciones pero solo ve y gestiona sus propias solicitudes, no las del resto. Administración y Administrador del sistema, con ámbito "todo", ven las de todos. Esto resuelve el acceso parcial sin romper la ocultación total: el Área es visible para ese rol, y dentro de ella solo existe lo propio.
- **Aprobación de facturas:** Administrador del sistema y Administración.
- **Aprobación de vacaciones:** solo Administrador del sistema.
- **Ajustes:** solo Administrador del sistema, limitado a gestión de usuarios y roles.
- **Stock y Leads para Podólogo y Ortopedia:** ven y editan ambas Áreas, porque hacen función puntual de recepción (coger llamadas, atender un lead, consultar o ajustar material).
- **Hoy:** siempre visible para todo rol, con sus propias tareas. Es la puerta de entrada de cada persona.

## 5. Reglas que protegen el modelo de permisos

- **Un solo mecanismo.** Cualquier permiso nuevo se expresa como Rol + Área + acciones. Nunca se crea un sistema paralelo de "permisos especiales".
- **Añadir un rol no toca la arquitectura.** Crear un nuevo rol no requiere modificar la arquitectura del sistema: basta con definir sus permisos sobre las Áreas existentes.
- **Las Áreas nuevas nacen con permisos.** Ninguna Área se construye sin definir qué rol la ve y con qué acciones. Un Área sin permisos definidos no se despliega.
- **Por defecto, sin acceso.** Un rol no ve un Área nueva hasta que se le concede explícitamente. Lo seguro es el silencio: si no se ha dicho que sí, es que no.

## 6. Principio de mínimo privilegio

Todo usuario dispone únicamente de los permisos necesarios para realizar su trabajo. Si existe duda sobre conceder un permiso, la decisión por defecto es no concederlo hasta que exista una necesidad real. Este principio encaja con los de simplicidad, ocultación total y mínima complejidad ya definidos: menos permisos es menos ruido, menos riesgo y menos que mantener.

---

*04-ROLES Y PERMISOS — cerrado.*

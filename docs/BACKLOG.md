# BACKLOG

*El cajón de las ideas buenas que no se construyen todavía. Nada aquí está rechazado — está aparcado hasta que haya un caso real que lo justifique. La regla del proyecto: no se introducen abstracciones ni objetos por anticipación; se ganan con evidencia de uso.*

---

## Objetos aparcados

**Notificación.** Un aviso puntual para un usuario que no siempre requiere acción. Aparcado porque todavía no está clara su diferencia real con una Tarea. Se recupera si durante el desarrollo aparece un caso donde un aviso sin acción aporte valor y no sea simplemente otro tipo de tarea.

## Conceptos de arquitectura aparcados

**Motor de eventos genérico.** La visión de "las cosas pasan y generan trabajo" se construye de momento con flujos escritos a mano dentro de cada Área + el objeto Tarea. Un motor configurable de eventos se reevaluará solo cuando existan ~10 flujos reales casi idénticos y el patrón sea evidente. Antes, sería complejidad sin justificar.

**Capas de "capacidades" componibles.** Una capacidad ("validar factura") es hoy un permiso sobre un objeto, que ya cubre el sistema de roles. Se reevaluará si aparece evidencia de uso que lo pida — no antes de tener varias Áreas construidas.

**Objeto "Actividad" como núcleo.** Idea de un objeto que capture todo el contexto de lo que ocurre (quién, cuándo, comentarios, qué detectó la IA). De momento la Tarea ya puede llevar ese contexto. Se reconsideraría solo si el uso real demuestra que la Tarea se queda corta.

## Ideas de producto aparcadas

**Entrada automática de datos en las Áreas.** La v1 de cada Área usa entrada manual. La entrada automática —facturas que llegan por email o Drive, lectura de PDF con IA para extraer proveedor/importe/IVA, y equivalentes en otras Áreas— es una mejora posterior que se diseñará con su propio análisis (integración con sistemas externos, revisión humana de lo detectado). Aparcada para no bloquear la primera Área ni comprometer arquitectura de integraciones antes de tiempo.

*(Aquí van las demás ideas de funcionalidad que surjan durante el desarrollo y no toque construir todavía.)*

---

*Cómo usar este archivo: cuando surja una idea buena a destiempo, entra aquí en una línea en vez de romper el flujo de trabajo. Cuando llegue su momento, se saca, se decide en DECISIONS.md y se construye.*

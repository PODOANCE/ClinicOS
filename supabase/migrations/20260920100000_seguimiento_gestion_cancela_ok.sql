-- Nuevo estado de gestión de recontacto: la persona contesta y cancela la
-- revisión porque está todo bien (distinto de "rechaza", que es una
-- negativa). Los textos de las etiquetas se actualizan solo en la app.
ALTER TYPE public.seguimiento_gestion_estado ADD VALUE 'CANCELA_TODO_OK';

-- ============================================================================
-- MIGRACIÓN: Corrección — created_by/updated_by deben apuntar a la persona
-- real, no a un actor técnico
-- Fecha: 2026-09-16
--
-- stock_categorias, stock_productos, vacaciones_trabajadores,
-- vacaciones_festivos y vacaciones_periodos definieron created_by/updated_by
-- como FK a usuarios_sistema (tabla de actores técnicos pensada para procesos
-- automatizados de Facturas; en producción tiene una única fila, SISTEMA_CRON).
--
-- A diferencia de stock_movimientos —que sí usa correctamente un actor
-- técnico vía RPC y además guarda a la persona real en su propia columna
-- usuario_id— estas 5 tablas no tienen ninguna otra columna de auditoría:
-- created_by/updated_by son su único rastro de quién hizo qué. Al no existir
-- ningún trigger que las rellene, cualquier alta desde la UI (crear
-- producto, crear grupo, crear periodo de vacaciones, marcar un festivo)
-- fallaría por violar la restricción NOT NULL, porque el cliente no puede
-- insertar un id de usuarios_sistema. Se repuntan a usuarios(id) y se
-- rellenan con auth.uid() desde el cliente.
-- ============================================================================

-- Orden obligatorio dentro de esta transacción:
--   1) DROP de las FK viejas (no valida nada, solo las quita)
--   2) backfill de los datos (ya sin ninguna FK que lo impida)
--   3) ADD de las FK nuevas hacia usuarios(id) (valida contra los datos ya
--      corregidos, que sí son ids válidos de usuarios)
-- Repuntar antes de hacer el backfill fallaría: ADD CONSTRAINT valida de
-- inmediato todas las filas existentes, y en ese momento seguirían teniendo
-- el id de SISTEMA_CRON, que no existe en usuarios.
ALTER TABLE public.stock_categorias
  DROP CONSTRAINT stock_categorias_created_by_fkey,
  DROP CONSTRAINT stock_categorias_updated_by_fkey;

ALTER TABLE public.stock_productos
  DROP CONSTRAINT stock_productos_created_by_fkey,
  DROP CONSTRAINT stock_productos_updated_by_fkey;

ALTER TABLE public.vacaciones_trabajadores
  DROP CONSTRAINT vacaciones_trabajadores_created_by_fkey,
  DROP CONSTRAINT vacaciones_trabajadores_updated_by_fkey;

ALTER TABLE public.vacaciones_festivos
  DROP CONSTRAINT vacaciones_festivos_created_by_fkey,
  DROP CONSTRAINT vacaciones_festivos_updated_by_fkey;

ALTER TABLE public.vacaciones_periodos
  DROP CONSTRAINT vacaciones_periodos_created_by_fkey,
  DROP CONSTRAINT vacaciones_periodos_updated_by_fkey;

DO $$
DECLARE
  v_admin UUID;
BEGIN
  SELECT id INTO v_admin FROM public.usuarios WHERE email = 'admin@podologiarivas.com' AND activo;
  IF v_admin IS NULL THEN
    RAISE EXCEPTION 'CORRECCION_ACTOR: no se encuentra admin@podologiarivas.com';
  END IF;

  -- Backfill de las filas ya migradas: tenían el actor técnico SISTEMA_CRON
  -- porque el esquema original apuntaba, por error, a usuarios_sistema. Se
  -- sustituye por la persona real que introdujo los datos iniciales.
  UPDATE public.stock_categorias SET created_by = v_admin, updated_by = v_admin
    WHERE created_by = '00000000-0000-0000-0000-000000000000';
  UPDATE public.stock_productos SET created_by = v_admin, updated_by = v_admin
    WHERE created_by = '00000000-0000-0000-0000-000000000000';
  UPDATE public.vacaciones_trabajadores SET created_by = v_admin, updated_by = v_admin
    WHERE created_by = '00000000-0000-0000-0000-000000000000';
  UPDATE public.vacaciones_festivos SET created_by = v_admin, updated_by = v_admin
    WHERE created_by = '00000000-0000-0000-0000-000000000000';
  UPDATE public.vacaciones_periodos SET created_by = v_admin, updated_by = v_admin
    WHERE created_by = '00000000-0000-0000-0000-000000000000';
END $$;

ALTER TABLE public.stock_categorias
  ADD CONSTRAINT stock_categorias_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  ADD CONSTRAINT stock_categorias_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.usuarios(id) ON DELETE RESTRICT;

ALTER TABLE public.stock_productos
  ADD CONSTRAINT stock_productos_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  ADD CONSTRAINT stock_productos_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.usuarios(id) ON DELETE RESTRICT;

ALTER TABLE public.vacaciones_trabajadores
  ADD CONSTRAINT vacaciones_trabajadores_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  ADD CONSTRAINT vacaciones_trabajadores_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.usuarios(id) ON DELETE RESTRICT;

ALTER TABLE public.vacaciones_festivos
  ADD CONSTRAINT vacaciones_festivos_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  ADD CONSTRAINT vacaciones_festivos_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.usuarios(id) ON DELETE RESTRICT;

ALTER TABLE public.vacaciones_periodos
  ADD CONSTRAINT vacaciones_periodos_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.usuarios(id) ON DELETE RESTRICT,
  ADD CONSTRAINT vacaciones_periodos_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.usuarios(id) ON DELETE RESTRICT;

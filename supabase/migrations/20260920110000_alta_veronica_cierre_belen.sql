-- Verónica entra el 19/10/2026. Prorrateo: 23 días/año ÷ 365 × 74 días
-- restantes del año (19/10 a 31/12 inclusive) = 4,66 → 5 días para 2026.
INSERT INTO public.vacaciones_trabajadores (nombre, color, dias_anuales, orden, usuario_id, centro_id, created_by, updated_by)
VALUES ('Verónica', '#3AAFA9', 5, 8, NULL, '12345678-1234-5678-1234-567812345678', 'dd87f885-8b49-4b25-9592-a5e49c08c746', 'dd87f885-8b49-4b25-9592-a5e49c08c746');

-- Belén: ningún periodo posterior al 18/09 (su último día); fijamos el
-- total anual a lo realmente disfrutado (18 días laborables, sin festivos
-- de por medio) para que su ficha quede cerrada en 0 pendientes.
UPDATE public.vacaciones_trabajadores
SET dias_anuales = 18, updated_by = 'dd87f885-8b49-4b25-9592-a5e49c08c746'
WHERE id = '0fac149e-1430-5359-93b0-6cf1c60cdf85';

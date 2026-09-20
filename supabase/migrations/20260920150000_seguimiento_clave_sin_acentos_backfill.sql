-- La nueva normalización de paciente_clave (lib/services/paciente-clave.ts)
-- quita acentos; las filas ya importadas se calcularon con la normalización
-- vieja (con acentos) y hay que recalcularlas para que sigan casando con
-- las nuevas importaciones — si no, un paciente con acento (ej. "JOSÉ")
-- se partiría en dos personas distintas al reimportar el histórico.
-- Comprobado antes de aplicar: no hay colisiones (ninguna clave nueva
-- agrupa a más de una clave vieja distinta) en ninguna de las dos tablas.
UPDATE public.seguimiento_citas
SET
  paciente_clave = translate(paciente_clave, 'ÁÉÍÓÚÑÜ', 'AEIOUNU'),
  huella = encode(
    extensions.digest(
      to_char(fecha, 'YYYY-MM-DD') || '|' || coalesce(hora, '') || '|' || coalesce(agenda, '') || '|'
        || translate(paciente_clave, 'ÁÉÍÓÚÑÜ', 'AEIOUNU') || '|' || tratamiento,
      'sha256'
    ),
    'hex'
  )
WHERE paciente_clave ~ '[ÁÉÍÓÚÑÜ]';

UPDATE public.seguimiento_gestion
SET paciente_clave = translate(paciente_clave, 'ÁÉÍÓÚÑÜ', 'AEIOUNU')
WHERE paciente_clave ~ '[ÁÉÍÓÚÑÜ]';

-- Faltaba el bloque de la página 1 que explica el motivo de la
-- intervención y la causa médica del problema (antes de "Yo autorizo...").
-- Se había quedado fuera al crear el esquema; se añade y se rellena para
-- el tema ya sembrado.
ALTER TABLE public.consentimientos_temas ADD COLUMN texto_advertencia TEXT NOT NULL DEFAULT '';

UPDATE public.consentimientos_temas
SET texto_advertencia = E'Quitar o mejorar ese dolor es el motivo de la intervención ya que sin dolor no se operaría. Es decir, por estética no se le opera.\n\nAdvertencia: La uña se suele deformar por el crecimiento de un pico de hueso en la falange justo debajo de la uña (como los picos de hueso que se forman en las falanges de la mano por artrosis). Generalmente, al quitar los bordes de la uña que se clavan en la carne, el dolor desaparece. Si no desapareciera el dolor, sería necesario quitar el pico de hueso en una segunda operación puesto que primero se empieza con la cirugía menos agresiva y después se pasa a la cirugía más agresiva.'
WHERE nombre = 'Cirugía Ungueal (Matricectomía)';

ALTER TABLE public.consentimientos_temas ALTER COLUMN texto_advertencia DROP DEFAULT;

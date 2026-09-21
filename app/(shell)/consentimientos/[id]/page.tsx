'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useUser } from '@/lib/contexts/UserContext'
import { getConsentimiento, getTemaConsentimiento } from '@/lib/supabase/queries/consentimientos'
import type { Consentimiento, ConsentimientoTema } from '@/lib/types/models'

const DENIM = '#183B5F'
const PUMPKIN = '#F18852'

function fechaLarga(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

// El texto se guarda con \n\n entre párrafos; aquí se renderiza cada uno
// como su propio <p>, y las líneas sueltas con \n como <br>.
function Parrafos({ texto }: { texto: string }) {
  return (
    <>
      {texto.split('\n\n').map((bloque, i) => (
        <p key={i} className="mb-2">
          {bloque.split('\n').map((linea, j) => (
            <span key={j}>
              {linea}
              {j < bloque.split('\n').length - 1 && <br />}
            </span>
          ))}
        </p>
      ))}
    </>
  )
}

export default function VerConsentimientoPage() {
  const params = useParams<{ id: string }>()
  const { user, loading: userLoading } = useUser()

  const [consentimiento, setConsentimiento] = useState<Consentimiento | null>(null)
  const [tema, setTema] = useState<ConsentimientoTema | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (user) cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  async function cargar() {
    try {
      setLoading(true)
      const c = await getConsentimiento(params.id)
      setConsentimiento(c)
      if (c?.tema_id) setTema(await getTemaConsentimiento(c.tema_id))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error cargando el consentimiento')
    } finally {
      setLoading(false)
    }
  }

  if (userLoading || loading) {
    return <div className="p-6 text-gray-500">Cargando...</div>
  }
  if (error) {
    return <div className="p-6 text-red-600">{error}</div>
  }
  if (!consentimiento || !tema) {
    return <div className="p-6 text-gray-500">No se ha encontrado ese consentimiento.</div>
  }

  return (
    <div className="p-6 space-y-4">
      <div className="no-imprimir flex items-center gap-3">
        <Link href="/consentimientos" className="text-xs font-medium underline decoration-dotted" style={{ color: PUMPKIN }}>
          ← Volver a Consentimientos
        </Link>
        <button
          onClick={() => window.print()}
          className="ml-auto px-4 py-1.5 rounded-full text-sm font-semibold text-white"
          style={{ backgroundColor: DENIM }}
        >
          🖨️ Imprimir / Guardar PDF
        </button>
      </div>

      <div className="imprimir-documento bg-white rounded-xl border border-gray-200 shadow-sm p-10 max-w-3xl mx-auto text-sm leading-relaxed">
        {/* Página 1 */}
        <h1 className="text-center text-lg font-bold mb-6" style={{ color: DENIM }}>{tema.titulo_documento}</h1>

        <div className="text-xs space-y-0.5 mb-6">
          <div><span className="font-semibold">NOMBRE DEL PACIENTE: </span>{consentimiento.paciente_nombre.toUpperCase()}</div>
          {consentimiento.paciente_nif && <div><span className="font-semibold">NIF: </span>{consentimiento.paciente_nif}</div>}
          {consentimiento.paciente_telefono && <div><span className="font-semibold">TELÉFONO: </span>{consentimiento.paciente_telefono}</div>}
          {consentimiento.paciente_historia_clinica && (
            <div><span className="font-semibold">Nº HISTORIA CLÍNICA: </span>{consentimiento.paciente_historia_clinica}</div>
          )}
        </div>

        <div className="mb-4">
          <div className="font-bold mb-1">A.- PROCEDIMIENTO:</div>
          <div className="font-semibold">{consentimiento.procedimiento_titulo}</div>
        </div>

        <div className="mb-4">
          <div className="font-bold mb-1">B.- CONSENTIMIENTO:</div>
          <p className="mb-2">
            Yo manifiesto que hoy, a fecha <strong>{fechaLarga(consentimiento.fecha)}</strong> por parte de{' '}
            <strong>{consentimiento.podologos}</strong>, colegiado/a en el Colegio Profesional de Podólogos de la Comunidad de Madrid, he
            sido informado/a de la naturaleza y el propósito de la intervención, los posibles tratamientos alternativos, los riesgos
            inherentes al procedimiento de cirugía menor, así como de las posibles complicaciones que pudieran existir y que se
            describen al dorso.
          </p>
          <p className="mb-2">Yo comprendo cual es el propósito, riesgos, tratamientos alternativos y posibles complicaciones del procedimiento.</p>
          <p className="mb-2">
            Yo declaro que habrá una persona conmigo durante los tres primeros días después de la cirugía y que voy a residir en un
            edificio donde hay ascensor por lo que no tendré que subir escaleras.
          </p>
          <p className="mb-1">Yo entiendo que el procedimiento de la intervención es:</p>
          <p className="italic mb-2">{consentimiento.descripcion_coloquial}</p>
          <Parrafos texto={tema.texto_advertencia} />
          <p className="mb-2">
            Yo autorizo al personal de la clínica a realizar la intervención que me ha sido explicada anteriormente, que se efectuara
            con anestesia local, así como para llevar a cabo las modificaciones técnicas, o correcciones de índole diagnostica y/o
            terapéutica que se estimen oportunas durante la misma, utilizando el instrumental y material que se considere necesario.
          </p>
          <p className="mb-4">
            Yo manifiesto haber recibido, tanto oral como por escrito, las instrucciones a seguir durante el postoperatorio, así como
            las respuestas y aclaraciones oportunas a todas las preguntas por mí planteadas.
          </p>
          <p className="mb-8">Considerando todo lo anterior, firmo la presente autorización en Madrid a {fechaLarga(consentimiento.fecha)}</p>
        </div>

        <div className="mt-10 text-center">
          <div className="mb-1">Fdo. por el paciente:</div>
          <div className="border-b border-gray-400 w-48 mx-auto h-16" />
        </div>

        {/* Página 2 */}
        <div className="break-before-page pt-10">
          <h2 className="text-center text-lg font-bold mb-6" style={{ color: DENIM }}>{tema.titulo_documento}</h2>

          <div className="font-bold mb-1">1.- Tratamientos alternativos a su problema:</div>
          <Parrafos texto={tema.texto_alternativas} />

          <div className="font-bold mb-1 mt-4">2.- Consecuencias típicas:</div>
          <Parrafos texto={tema.texto_consecuencias} />

          <div className="font-bold mb-1 mt-4">2.- Precauciones:</div>
          <Parrafos texto={tema.texto_precauciones} />

          <div className="font-bold mb-1 mt-4">3.- Complicaciones típicas:</div>
          <Parrafos texto={tema.texto_complicaciones_tipicas} />

          <div className="font-bold mb-1 mt-4">4.- Complicaciones muy graves:</div>
          <Parrafos texto={tema.texto_complicaciones_graves} />

          <div className="font-bold mb-1 mt-4">5.- Postoperatorio típico, atendiendo a su tratamiento quirúrgico:</div>
          <Parrafos texto={tema.texto_postoperatorio} />

          <div className="mt-10 text-center">
            <div className="mb-1">Fdo. por el paciente:</div>
            <div className="border-b border-gray-400 w-48 mx-auto h-16" />
          </div>
        </div>
      </div>
    </div>
  )
}

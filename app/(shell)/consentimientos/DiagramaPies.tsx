// Diagrama de los dos pies desde arriba, con las uñas de cada dedo
// divididas en sus dos canales — para marcar a mano en el papel impreso
// cuál se interviene. Vectorial (SVG), así que imprime nítido a cualquier
// tamaño; no depende de ninguna imagen externa.

const ANCHOS_DEDO = [34, 26, 22, 19, 16] // del gordo (I) al meñique (V)
const ALTOS_DEDO = [70, 52, 46, 40, 34]

function Dedo({ x, y, ancho, alto, numero }: { x: number; y: number; ancho: number; alto: number; numero: string }) {
  const radioUna = ancho * 0.42
  return (
    <g>
      {/* Falange */}
      <rect x={x - ancho / 2} y={y} width={ancho} height={alto} rx={ancho / 2} fill="none" stroke="#1f2937" strokeWidth={1.5} />
      {/* Uña, dividida en dos canales para marcar */}
      <g>
        <path
          d={`M ${x - radioUna} ${y + alto * 0.32} a ${radioUna} ${radioUna * 0.85} 0 0 1 ${radioUna * 2} 0 v ${alto * 0.12} a ${radioUna} ${radioUna * 0.85} 0 0 1 ${-radioUna * 2} 0 z`}
          fill="none"
          stroke="#1f2937"
          strokeWidth={1.25}
        />
        <line x1={x} y1={y + alto * 0.32 - radioUna * 0.85} x2={x} y2={y + alto * 0.32 + radioUna * 0.85 + alto * 0.12} stroke="#1f2937" strokeWidth={1} />
      </g>
      <text x={x} y={y + alto + 13} textAnchor="middle" fontSize={9} fill="#6b7280">{numero}</text>
    </g>
  )
}

function Pie({ xCentro, yBase, espejo }: { xCentro: number; yBase: number; espejo: boolean }) {
  const numerosBase = ['I', 'II', 'III', 'IV', 'V']
  const gap = 6
  // Pie derecho: gordo (I) a la izquierda de la fila. Pie izquierdo: en
  // espejo, gordo (I) a la derecha — se invierte el ORDEN de la lista
  // antes de calcular posiciones, no las x ya calculadas.
  const anchos = espejo ? [...ANCHOS_DEDO].reverse() : ANCHOS_DEDO
  const altos = espejo ? [...ALTOS_DEDO].reverse() : ALTOS_DEDO
  const numeros = espejo ? [...numerosBase].reverse() : numerosBase

  const anchoTotal = anchos.reduce((s, a) => s + a, 0) + gap * (anchos.length - 1)
  let cursor = xCentro - anchoTotal / 2

  const dedosFinal = anchos.map((ancho, i) => {
    const alto = altos[i]
    const x = cursor + ancho / 2
    cursor += ancho + gap
    return { x, ancho, alto, numero: numeros[i] }
  })

  const yDedos = yBase - 150
  const anchoEmpeine = anchoTotal + 30

  return (
    <g>
      {/* Empeine/pie, simplificado */}
      <path
        d={`M ${xCentro - anchoEmpeine / 2} ${yDedos + 60}
            C ${xCentro - anchoEmpeine / 2 - 10} ${yDedos + 140}, ${xCentro - anchoEmpeine / 2 + 15} ${yBase - 10}, ${xCentro} ${yBase}
            C ${xCentro + anchoEmpeine / 2 - 15} ${yBase - 10}, ${xCentro + anchoEmpeine / 2 + 10} ${yDedos + 140}, ${xCentro + anchoEmpeine / 2} ${yDedos + 60}
            Z`}
        fill="none"
        stroke="#1f2937"
        strokeWidth={1.5}
      />
      {dedosFinal.map((d) => (
        <Dedo key={d.numero} x={d.x} y={yDedos} ancho={d.ancho} alto={d.alto} numero={d.numero} />
      ))}
    </g>
  )
}

export function DiagramaPies() {
  return (
    <div className="my-4">
      <div className="text-xs font-semibold text-center mb-1">Marque el canal a intervenir</div>
      <svg viewBox="0 0 520 260" className="w-full max-w-sm mx-auto">
        <Pie xCentro={155} yBase={250} espejo={true} />
        <Pie xCentro={365} yBase={250} espejo={false} />
        <text x={155} y={20} textAnchor="middle" fontSize={10} fill="#6b7280">PIE IZQUIERDO</text>
        <text x={365} y={20} textAnchor="middle" fontSize={10} fill="#6b7280">PIE DERECHO</text>
      </svg>
    </div>
  )
}

import { useLayoutEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { renderEffectText } from '../../lib/card/renderEffectText'

interface Props {
  texto?: string
  /** bloques extra específicos del tipo de carta (Piloto, Gear, Orden) */
  children?: ReactNode
  /** cambia cuando cambia cualquier contenido que afecte al alto */
  fitKey?: string
}

const MAX_FONT = 14
const MIN_FONT = 8.5
const STEP = 0.4

/**
 * Caja de texto de reglas.
 * - Las keywords se resaltan y los delimitadores < > nunca se imprimen.
 * - El tamaño de fuente se auto-ajusta midiendo el contenido, de modo que
 *   el texto nunca se recorta por muy largo que sea.
 */
export default function CardEffect({ texto, children, fitKey }: Props) {
  const boxRef = useRef<HTMLDivElement>(null)
  const fitRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const box = boxRef.current
    const fit = fitRef.current
    if (!box || !fit) return

    let size = MAX_FONT
    fit.style.fontSize = `${size}px`

    const available = () => box.clientHeight - 2
    while (size > MIN_FONT && fit.scrollHeight > available()) {
      size = Math.max(MIN_FONT, size - STEP)
      fit.style.fontSize = `${size}px`
    }
  }, [texto, fitKey, children])

  return (
    <div className="card-effect" ref={boxRef}>
      <div className="effect-fit" ref={fitRef}>
        {children}
        {texto ? <p className="effect-text">{renderEffectText(texto)}</p> : null}
      </div>
    </div>
  )
}

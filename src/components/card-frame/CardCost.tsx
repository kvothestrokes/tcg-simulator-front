import { IconHeat, IconRecursos } from './icons/Symbology'

interface Props {
  recursos: number
  heat: number
}

function CostValue({ value }: { value: number }) {
  return (
    <svg className="cost-layer cost-value-svg" width="68" height="68" viewBox="0 0 68 68" aria-hidden="true">
      <text
        x="34"
        y="44"
        textAnchor="middle"
        fill="#ffffff"
        fontSize="28"
        fontWeight="700"
        fontFamily="Orbitron, Rajdhani, system-ui, sans-serif"
      >
        {value}
      </text>
    </svg>
  )
}

/** Costes en las esquinas superiores: recursos (círculo) y heat (hexágono). */
export default function CardCost({ recursos, heat }: Props) {
  return (
    <>
      <div className="cost-badge cost-resources" title="Coste de recursos">
        <span className="cost-layer cost-glyph">
          <IconRecursos size={68} color="#2f6fc4" />
        </span>
        <CostValue value={recursos} />
      </div>

      <div className="cost-badge cost-heat" title="Coste de Heat">
        <span className="cost-layer cost-glyph">
          <IconHeat size={68} color="#b4531c" />
        </span>
        <CostValue value={heat} />
      </div>
    </>
  )
}

import { RARITY_COLORS } from '../../lib/card/factions'

interface Props {
  autor: string
  rareza: string
  numero: string
}

/** Pie de carta: autor, rareza y número de colección. */
export default function CardFaction({ autor, rareza, numero }: Props) {
  const color = RARITY_COLORS[rareza] ?? '#8f9bb0'

  return (
    <footer className="card-footer">
      <span className="footer-author">{autor ? autor.toLocaleUpperCase('es') : '—'}</span>
      <span className="footer-right">
        <span className="rarity-dot" style={{ background: color, boxShadow: `0 0 8px ${color}` }} />
        <span className="footer-meta" style={{ color }}>
          {rareza.toLocaleUpperCase('es')}
        </span>
        <span className="footer-sep">·</span>
        <span className="footer-meta">{numero.toLocaleUpperCase('es')}</span>
      </span>
    </footer>
  )
}

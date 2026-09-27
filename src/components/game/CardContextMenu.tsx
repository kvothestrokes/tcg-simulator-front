import type { CardInstance } from '../../lib/game/types';

export interface ContextMenuState {
  x: number;
  y: number;
  card: CardInstance;
  owned: boolean;
}

interface CardContextMenuProps {
  menu: ContextMenuState;
  canAct: boolean;
  onClose: () => void;
  onTap: (tapped: boolean) => void;
  onDamage: (value: number) => void;
  /** Sets the "carga" counter. */
  onCharge: (value: number) => void;
  onToVoid: () => void;
  onToHand: () => void;
  onToDeck: (position: 'top' | 'bottom') => void;
  onUnlink?: () => void;
  onAttack?: () => void;
  onDestroy?: () => void;
}

export function CardContextMenu({
  menu,
  canAct,
  onClose,
  onTap,
  onDamage,
  onCharge,
  onToVoid,
  onToHand,
  onToDeck,
  onUnlink,
  onAttack,
  onDestroy,
}: CardContextMenuProps) {
  const damage = menu.card.counters.daño ?? 0;
  const charge = menu.card.counters.carga ?? 0;
  const disabled = !canAct || !menu.owned;
  const why = !canAct
    ? 'Sin conexión o partida cerrada.'
    : !menu.owned
      ? 'Solo puedes actuar sobre tus cartas.'
      : undefined;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 cursor-default bg-transparent"
        aria-label="Cerrar menú"
        onClick={onClose}
        onContextMenu={(event) => {
          event.preventDefault();
          onClose();
        }}
      />
      <ul
        className="fixed z-50 min-w-[180px] border border-[var(--color-stroke)] bg-[var(--color-hull)] py-1 text-[11px]"
        style={{ left: menu.x, top: menu.y }}
        role="menu"
      >
        <MenuItem
          disabled={disabled}
          why={why}
          hint={menu.card.tapped ? 'La carta vuelve a estar lista' : 'Gira la carta 90°: queda agotada'}
          onClick={() => onTap(!menu.card.tapped)}
        >
          {menu.card.tapped ? 'Enderezar' : 'Agotar (girar)'}
        </MenuItem>
        <MenuItem disabled={disabled} why={why} hint="Añade 1 contador de daño" onClick={() => onDamage(damage + 1)}>
          Daño +1 ({damage})
        </MenuItem>
        <MenuItem
          disabled={disabled || damage <= 0}
          why={why ?? (damage <= 0 ? 'No tiene daño.' : undefined)}
          hint="Quita 1 contador de daño"
          onClick={() => onDamage(damage - 1)}
        >
          Daño −1
        </MenuItem>
        <MenuItem
          disabled={disabled}
          why={why}
          hint="Añade 1 contador de carga (marcador manual)"
          onClick={() => onCharge(charge + 1)}
        >
          <span style={{ color: disabled ? undefined : 'var(--color-charge)' }}>⚡</span> Carga +1 ({charge})
        </MenuItem>
        <MenuItem
          disabled={disabled || charge <= 0}
          why={why ?? (charge <= 0 ? 'No tiene carga.' : undefined)}
          hint="Quita 1 contador de carga"
          onClick={() => onCharge(charge - 1)}
        >
          <span style={{ color: disabled || charge <= 0 ? undefined : 'var(--color-charge)' }}>⚡</span> Carga −1
        </MenuItem>
        {onAttack ? (
          <MenuItem
            disabled={disabled}
            why={why}
            hint="Elige después una nave o la estación enemiga"
            onClick={onAttack}
          >
            Declarar ataque
          </MenuItem>
        ) : null}
        {onUnlink ? (
          <MenuItem disabled={disabled} why={why} hint="Separa la carta de su nave" onClick={onUnlink}>
            Desenganchar
          </MenuItem>
        ) : null}
        {onDestroy ? (
          <MenuItem
            disabled={disabled}
            why={why}
            hint="Al Vacío; su piloto vuelve a la reserva y sus gears a Recursos"
            onClick={onDestroy}
          >
            Destruir
          </MenuItem>
        ) : null}
        <MenuItem disabled={disabled} why={why} hint="Pila de descarte pública; pierde sus contadores" onClick={onToVoid}>
          Enviar al vacío
        </MenuItem>
        <MenuItem disabled={disabled} why={why} hint="Devuelve la carta a tu mano" onClick={onToHand}>
          A la mano
        </MenuItem>
        <MenuItem disabled={disabled} why={why} hint="La pone encima de tu mazo" onClick={() => onToDeck('top')}>
          Al tope del mazo
        </MenuItem>
        <MenuItem disabled={disabled} why={why} hint="La pone debajo de tu mazo" onClick={() => onToDeck('bottom')}>
          Al fondo del mazo
        </MenuItem>
      </ul>
    </>
  );
}

function MenuItem({
  children,
  disabled,
  hint,
  why,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  /** What the action does. */
  hint?: string;
  /** Why it is disabled. */
  why?: string;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        role="menuitem"
        className="w-full px-3 py-1.5 text-left hover:bg-[rgba(255,255,255,0.08)] disabled:opacity-35"
        disabled={disabled}
        title={disabled && why ? `${hint ? `${hint} — ` : ''}No disponible: ${why}` : hint}
        onClick={onClick}
      >
        {children}
      </button>
    </li>
  );
}

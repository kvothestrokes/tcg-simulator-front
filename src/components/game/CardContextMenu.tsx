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
  onToVoid,
  onToHand,
  onToDeck,
  onUnlink,
  onAttack,
  onDestroy,
}: CardContextMenuProps) {
  const damage = menu.card.counters.daño ?? 0;
  const disabled = !canAct || !menu.owned;

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
        <MenuItem disabled={disabled} onClick={() => onTap(!menu.card.tapped)}>
          {menu.card.tapped ? 'Enderezar' : 'Agotar (girar)'}
        </MenuItem>
        <MenuItem disabled={disabled} onClick={() => onDamage(damage + 1)}>
          Daño +1 ({damage})
        </MenuItem>
        <MenuItem disabled={disabled || damage <= 0} onClick={() => onDamage(damage - 1)}>
          Daño −1
        </MenuItem>
        {onAttack ? (
          <MenuItem disabled={disabled} onClick={onAttack}>
            Declarar ataque
          </MenuItem>
        ) : null}
        {onUnlink ? (
          <MenuItem disabled={disabled} onClick={onUnlink}>
            Desenganchar
          </MenuItem>
        ) : null}
        {onDestroy ? (
          <MenuItem disabled={disabled} onClick={onDestroy}>
            Destruir
          </MenuItem>
        ) : null}
        <MenuItem disabled={disabled} onClick={onToVoid}>
          Enviar al vacío
        </MenuItem>
        <MenuItem disabled={disabled} onClick={onToHand}>
          A la mano
        </MenuItem>
        <MenuItem disabled={disabled} onClick={() => onToDeck('top')}>
          Al tope del mazo
        </MenuItem>
        <MenuItem disabled={disabled} onClick={() => onToDeck('bottom')}>
          Al fondo del mazo
        </MenuItem>
      </ul>
    </>
  );
}

function MenuItem({
  children,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        role="menuitem"
        className="w-full px-3 py-1.5 text-left hover:bg-[rgba(255,255,255,0.08)] disabled:opacity-35"
        disabled={disabled}
        onClick={onClick}
      >
        {children}
      </button>
    </li>
  );
}

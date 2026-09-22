import { CardStack } from './CardTile';
import { Panel } from '../ui/Panel';
import { PHASES, normalizePhase, type Phase } from '../../lib/game/types';

interface CenterStripProps {
  sharedCount: number;
  phase: string;
  turn: number;
  isMyTurn: boolean;
  canAct: boolean;
  /** Puedes robar del mazo compartido: es tu turno, queda mazo y no robaste aún. */
  canDrawResource: boolean;
  /** Ya usaste tu robo de recurso este turno. */
  resourceDrawnThisTurn: boolean;
  gameOverText?: string;
  onAdvancePhase: () => void;
  onDrawResource: () => void;
  onSpawnToken: () => void;
}

const NEXT_LABEL: Record<Phase, string> = {
  Inicial: 'Activar',
  Activación: 'Principal',
  Principal: 'Final',
  Final: 'Pasar turno',
};

export function CenterStrip({
  sharedCount,
  phase,
  turn,
  isMyTurn,
  canAct,
  canDrawResource,
  resourceDrawnThisTurn,
  gameOverText,
  onAdvancePhase,
  onDrawResource,
  onSpawnToken,
}: CenterStripProps) {
  const current = normalizePhase(phase);
  const label = gameOverText
    ? 'Partida terminada'
    : !isMyTurn
      ? 'Espera al rival'
      : current === 'Final'
        ? 'Relevar turno'
        : `Fase ${NEXT_LABEL[current]}`;

  const resourceHint = sharedCount <= 0
    ? 'Mazo agotado'
    : resourceDrawnThisTurn
      ? 'Ya robaste este turno'
      : isMyTurn
        ? '1 por turno'
        : 'Espera tu turno';

  return (
    <div className="flex shrink-0 items-center gap-3 px-2 py-1">
      <Panel cut={8} className="shrink-0" innerClassName="flex items-center gap-3 px-2.5 py-1.5">
        <CardStack count={sharedCount} width={54} label="Recursos" />
        <div className="flex flex-col gap-1">
          <div>
            <p className="hud-title text-[9px]">Mazo compartido</p>
            <p className="hud-sub tabular text-[9px]">{sharedCount}/15</p>
          </div>
          <button
            type="button"
            className="btn btn--sm btn--primary"
            onClick={onDrawResource}
            disabled={!canAct || !canDrawResource}
            title="Roba una carta de recurso a tu Zona de Recursos"
          >
            ⟳ Robar recurso
          </button>
          <span className="hud-sub text-[8px]">{resourceHint}</span>
        </div>
      </Panel>

      <button
        type="button"
        className="btn btn--sm"
        onClick={onSpawnToken}
        disabled={!canAct || !isMyTurn}
      >
        Tokens
      </button>

      <span className="h-px flex-1 bg-[var(--color-stroke-faint)]" />

      <button
        type="button"
        className="btn btn--primary min-w-[180px]"
        onClick={onAdvancePhase}
        disabled={!canAct || Boolean(gameOverText) || (!isMyTurn && Boolean(phase))}
        title={PHASES.join(' → ')}
      >
        <span className="block text-[10px] tracking-widest">Turno {turn} · {current}</span>
        <span className="block text-[11px]">{label}</span>
      </button>

      <span className="h-px flex-1 bg-[var(--color-stroke-faint)]" />

      {gameOverText ? (
        <span className="hud-sub text-[var(--color-heat-max)]">{gameOverText}</span>
      ) : (
        <span className="hud-sub text-[9px]">{isMyTurn ? 'Tu iniciativa' : 'Iniciativa rival'}</span>
      )}
    </div>
  );
}

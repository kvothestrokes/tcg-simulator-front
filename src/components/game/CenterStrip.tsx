import { CardStack } from './CardTile';
import { Panel } from '../ui/Panel';
import { PHASES, normalizePhase, type Phase } from '../../lib/game/types';

interface CenterStripProps {
  sharedCount: number;
  phase: string;
  turn: number;
  isMyTurn: boolean;
  canAct: boolean;
  gameOverText?: string;
  onAdvancePhase: () => void;
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
  gameOverText,
  onAdvancePhase,
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

  return (
    <div className="flex shrink-0 items-center gap-3 px-2 py-1">
      <Panel cut={8} className="shrink-0" innerClassName="flex items-center gap-3 px-2 py-1.5">
        <CardStack count={sharedCount} width={56} label="Recursos" />
        <div>
          <p className="hud-title text-[9px]">Mazo compartido</p>
          <p className="hud-sub tabular text-[9px]">{sharedCount}/15</p>
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

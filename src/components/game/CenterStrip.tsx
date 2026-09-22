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

/**
 * Franja de control entre los dos tableros. Es una barra fina de una sola línea:
 * turno/fase a la izquierda, acciones al centro e iniciativa a la derecha. No
 * gasta alto ni deja huecos vacíos (antes el botón de turno se comía la franja).
 */
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
        ? 'Pasar turno'
        : NEXT_LABEL[current];

  const resourceHint =
    sharedCount <= 0
      ? 'Mazo agotado'
      : resourceDrawnThisTurn
        ? 'Recurso ya robado'
        : isMyTurn
          ? '1 recurso por turno'
          : 'Espera tu turno';

  return (
    <div className="hud flex shrink-0 items-center gap-3 px-3 py-1.5" style={{ ['--cut' as string]: '8px' }}>
      <div className="hud__inner flex w-full items-center gap-3">
        {/* Turno + fase */}
        <div className="flex items-baseline gap-1.5">
          <span className="hud-title tabular text-[11px]">Turno {turn}</span>
          <span
            className="hud-sub text-[10px]"
            style={{ color: isMyTurn ? 'var(--color-signal)' : undefined }}
          >
            {current}
          </span>
        </div>

        <span className="h-4 w-px bg-[var(--color-stroke-faint)]" />

        {/* Avanzar fase */}
        <button
          type="button"
          className="btn btn--sm btn--primary min-w-[104px]"
          onClick={onAdvancePhase}
          disabled={!canAct || Boolean(gameOverText) || (!isMyTurn && Boolean(phase))}
          title={PHASES.join(' → ')}
        >
          {label}
        </button>

        {/* Recurso compartido */}
        <button
          type="button"
          className="btn btn--sm"
          onClick={onDrawResource}
          disabled={!canAct || !canDrawResource}
          title="Roba una carta de recurso a tu Zona de Recursos (1 por turno)"
        >
          ⟳ Recurso
        </button>
        <span className="hud-sub tabular text-[10px]">{sharedCount}/15</span>

        {/* Tokens */}
        <button
          type="button"
          className="btn btn--sm"
          onClick={onSpawnToken}
          disabled={!canAct || !isMyTurn}
          title="Despliega un dron token en tu Zona de Batalla"
        >
          Token
        </button>

        <span className="hud-sub text-[9px] opacity-70">{resourceHint}</span>

        {/* Iniciativa */}
        <span className="ml-auto shrink-0 text-[10px]">
          {gameOverText ? (
            <span className="hud-sub text-[var(--color-heat-max)]">{gameOverText}</span>
          ) : (
            <span
              className="hud-sub"
              style={{ color: isMyTurn ? 'var(--color-signal)' : undefined }}
            >
              {isMyTurn ? '● Tu iniciativa' : 'Iniciativa rival'}
            </span>
          )}
        </span>
      </div>
    </div>
  );
}

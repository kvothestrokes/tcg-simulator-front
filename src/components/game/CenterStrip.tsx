import { PHASES } from '../../lib/game/types';
import { phaseChipStates, type PhaseTransition } from '../../lib/game/phaseInfo';

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
  /** What the advance button declares next (derived from the reducer, see phaseInfo). */
  transition: PhaseTransition;
  /** No free battle slot left for a token. */
  battleFull: boolean;
  gameOverText?: string;
  onAdvancePhase: () => void;
  onDrawResource: () => void;
  onSpawnToken: () => void;
}

const OFFLINE = 'Sin conexión o partida cerrada.';

/**
 * Franja de control entre los dos tableros: turno y chips de fase a la
 * izquierda, el botón de avanzar (que dice qué hará la siguiente transición),
 * acciones al centro e iniciativa a la derecha.
 */
export function CenterStrip({
  sharedCount,
  phase,
  turn,
  isMyTurn,
  canAct,
  canDrawResource,
  resourceDrawnThisTurn,
  transition,
  battleFull,
  gameOverText,
  onAdvancePhase,
  onDrawResource,
  onSpawnToken,
}: CenterStripProps) {
  const chips = phaseChipStates(phase);

  const advanceBlock = gameOverText
    ? 'La partida terminó.'
    : !canAct
      ? OFFLINE
      : transition.kind === 'wait'
        ? 'Solo quien tiene el turno avanza la fase.'
        : null;

  const resourceBlock = !canAct
    ? OFFLINE
    : sharedCount <= 0
      ? 'El mazo compartido de recursos está agotado.'
      : resourceDrawnThisTurn
        ? 'Ya recibiste el recurso de este turno.'
        : !isMyTurn
          ? 'Solo en tu turno.'
          : !canDrawResource
            ? 'No disponible ahora.'
            : null;

  const tokenBlock = !canAct
    ? OFFLINE
    : !isMyTurn
      ? 'Solo en tu turno.'
      : battleFull
        ? 'No quedan huecos libres en tu Zona de Batalla.'
        : null;

  const resourceHint =
    sharedCount <= 0
      ? 'Mazo agotado'
      : resourceDrawnThisTurn
        ? 'Recurso del turno recibido'
        : isMyTurn
          ? '1 recurso por turno'
          : 'Espera tu turno';

  const advanceTitle = advanceBlock
    ? `${transition.label} — No disponible: ${advanceBlock}`
    : `${transition.label}: ${transition.detail}. Orden de fases: ${PHASES.join(' → ')}.`;

  return (
    <div className="center-glow shrink-0">
      <div className="hud flex items-center gap-3 px-3 py-1.5" style={{ ['--cut' as string]: '8px' }}>
        <div className="hud__inner flex w-full items-center gap-3">
          {/* Turno + chips de fase */}
          <div className="flex items-center gap-2">
            <span className="hud-title tabular text-[11px]">Turno {turn}</span>
            <ol className="flex items-center gap-1" aria-label="Fases del turno">
              {PHASES.map((name, index) => (
                <li
                  key={name}
                  className="phase-chip"
                  data-state={chips[index]}
                  aria-current={chips[index] === 'current' ? 'step' : undefined}
                  title={
                    chips[index] === 'current'
                      ? `Fase actual: ${name}`
                      : chips[index] === 'past'
                        ? `${name}: ya pasó este turno`
                        : `${name}: pendiente`
                  }
                >
                  {index + 1}. {name}
                </li>
              ))}
            </ol>
          </div>

          <span className="h-4 w-px bg-[var(--color-stroke-faint)]" />

          {/* Avanzar fase: la etiqueta dice qué hará la siguiente transición. */}
          <span className="advance-glow">
            <button
              type="button"
              className="btn btn--sm btn--advance min-w-[168px] max-w-[280px]"
              onClick={onAdvancePhase}
              disabled={Boolean(advanceBlock)}
              title={advanceTitle}
            >
              <span>{gameOverText ? 'Partida terminada' : transition.label}</span>
              {!gameOverText ? (
                <span className="btn--advance__sub block max-w-full truncate">{transition.detail}</span>
              ) : null}
            </button>
          </span>

          {/* Recurso compartido */}
          <button
            type="button"
            className="btn btn--sm"
            onClick={onDrawResource}
            disabled={Boolean(resourceBlock)}
            title={
              resourceBlock
                ? `Robar recurso — No disponible: ${resourceBlock}`
                : 'Respaldo manual: el recurso del turno se roba solo al empezar tu turno. Úsalo únicamente si no llegó (1 por turno).'
            }
          >
            ⟳ Recurso
          </button>
          <span
            className="hud-sub tabular text-[10px]"
            style={{ color: 'var(--color-zone-resources)' }}
            title="Cartas que quedan en el mazo compartido de recursos"
          >
            {sharedCount}/15
          </span>

          {/* Tokens */}
          <button
            type="button"
            className="btn btn--sm"
            onClick={onSpawnToken}
            disabled={Boolean(tokenBlock)}
            title={
              tokenBlock
                ? `Token — No disponible: ${tokenBlock}`
                : 'Despliega un dron token (10/10) en el primer hueco libre de tu Zona de Batalla. Si sale de batalla, se retira de la partida.'
            }
          >
            Token
          </button>

          <span className="hud-sub text-[9px] opacity-70">{resourceHint}</span>

          {/* Iniciativa */}
          <span className="ml-auto shrink-0 text-[10px]">
            {gameOverText ? (
              <span className="hud-sub text-[var(--color-heat-max)]">{gameOverText}</span>
            ) : isMyTurn ? (
              <span className="hud-sub turn-pill">● Tu iniciativa</span>
            ) : (
              <span className="hud-sub">Iniciativa rival</span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

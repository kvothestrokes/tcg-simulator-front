/**
 * Inspector de la carta seleccionada.
 *
 * Es también el camino accesible y táctil para TODO lo que se puede hacer
 * arrastrando: mover entre zonas, girar, voltear y poner contadores. Nada del
 * juego depende de saber arrastrar.
 *
 * Ninguna de estas acciones valida reglas. Puedes mover cualquier carta a
 * cualquier zona en cualquier momento, igual que en una mesa física.
 */

import { CardTile } from './CardTile';
import { Panel } from '../ui/Panel';
import type { PrivateCard } from '../../hooks/usePrivateDeck';
import {
  CARD_TYPE_LABEL,
  FACTIONS,
  PILOT_SLOTS,
  ZONE_LABEL,
  type CardInstance,
  type ZoneId,
} from '../../lib/game/types';

export type Selection =
  | { kind: 'hand'; card: PrivateCard }
  | { kind: 'board'; card: CardInstance; owned: boolean }
  | null;

interface CardInspectorProps {
  selection: Selection;
  onClose: () => void;
  onPlay: (to: ZoneId, options?: { faceUp?: boolean; slot?: number }) => void;
  onMove: (to: ZoneId, options?: { slot?: number }) => void;
  onTap: (tapped: boolean) => void;
  onFlip: (faceUp: boolean) => void;
  onCounter: (key: string, value: number) => void;
  onToHand: () => void;
  onToDeck: () => void;
  onDiscardFromHand: () => void;
}

const PLAY_TARGETS: ZoneId[] = ['battle', 'station', 'resources'];
const MOVE_TARGETS: ZoneId[] = ['battle', 'station', 'resources', 'void'];
const COUNTER_KEYS = ['daño', 'escudo', 'marca'] as const;

export function CardInspector({
  selection,
  onClose,
  onPlay,
  onMove,
  onTap,
  onFlip,
  onCounter,
  onToHand,
  onToDeck,
  onDiscardFromHand,
}: CardInspectorProps) {
  if (!selection) {
    return (
      <Panel tone="dim" cut={10} className="shrink-0" innerClassName="px-3 py-4">
        <p className="hud-sub text-[10px] leading-relaxed">
          Selecciona una carta para verla y actuar sobre ella. También puedes
          arrastrarla de una zona a otra.
        </p>
      </Panel>
    );
  }

  const def = selection.kind === 'hand' ? selection.card.def : selection.card.def;
  const instance = selection.kind === 'board' ? selection.card : undefined;
  const editable = selection.kind === 'hand' || selection.owned;
  const faction = FACTIONS[def.faction];

  return (
    <Panel cut={10} className="shrink-0" innerClassName="flex flex-col gap-3 p-3">
      <header className="flex items-start gap-3">
        <CardTile def={def} instance={instance} width={64} />
        <div className="min-w-0 flex-1">
          <h3 className="hud-title text-xs leading-tight">{def.name}</h3>
          <p className="hud-sub mt-1 text-[9px]" style={{ color: faction.color }}>
            {faction.name}
          </p>
          <p className="hud-sub mt-0.5 text-[9px]">
            {CARD_TYPE_LABEL[def.type]} · Coste {def.cost}
            {def.power !== undefined ? ` · ${def.power}/${def.integrity ?? '—'}` : ''}
          </p>
        </div>
        <button
          type="button"
          className="step shrink-0"
          onClick={onClose}
          aria-label="Cerrar inspector"
        >
          ×
        </button>
      </header>

      <p className="text-[11px] leading-relaxed text-[var(--color-ink-dim)]">{def.text}</p>

      {def.keywords?.length ? (
        <div className="flex flex-wrap gap-1">
          {def.keywords.map((keyword) => (
            <span
              key={keyword}
              className="hud-sub border border-[var(--color-stroke-faint)] px-1.5 py-0.5 text-[9px]"
            >
              {keyword}
            </span>
          ))}
        </div>
      ) : null}

      {!editable ? (
        <p className="hud-sub text-[9px] opacity-60">Carta del rival: solo lectura.</p>
      ) : selection.kind === 'hand' ? (
        // --- carta en la mano -------------------------------------------------
        <>
          <Group label="Jugar en">
            {PLAY_TARGETS.map((zone) => (
              <button
                key={zone}
                type="button"
                className="btn btn--sm"
                onClick={() => onPlay(zone)}
              >
                {ZONE_LABEL[zone]}
              </button>
            ))}
          </Group>

          <Group label="Asignar piloto">
            {Array.from({ length: PILOT_SLOTS }, (_, slot) => (
              <button
                key={slot}
                type="button"
                className="btn btn--sm"
                onClick={() => onPlay('pilots', { slot })}
              >
                Hueco {slot + 1}
              </button>
            ))}
          </Group>

          <Group label="Boca abajo">
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => onPlay('resources', { faceUp: false })}
            >
              A recursos
            </button>
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => onPlay('battle', { faceUp: false })}
            >
              A batalla
            </button>
          </Group>

          <Group label="Descartar">
            <button type="button" className="btn btn--sm btn--danger" onClick={onDiscardFromHand}>
              Al Vacío
            </button>
          </Group>
        </>
      ) : (
        // --- carta en el tablero ----------------------------------------------
        <>
          <Group label="Estado">
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => onTap(!(instance?.tapped ?? false))}
            >
              {instance?.tapped ? 'Enderezar' : 'Girar'}
            </button>
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => onFlip(!(instance?.faceUp ?? true))}
            >
              {instance?.faceUp ? 'Boca abajo' : 'Boca arriba'}
            </button>
          </Group>

          <Group label="Mover a">
            {MOVE_TARGETS.filter((zone) => zone !== instance?.zone).map((zone) => (
              <button
                key={zone}
                type="button"
                className="btn btn--sm"
                onClick={() => onMove(zone)}
              >
                {ZONE_LABEL[zone]}
              </button>
            ))}
            {instance?.zone !== 'pilots'
              ? Array.from({ length: PILOT_SLOTS }, (_, slot) => (
                  <button
                    key={`pilot-${slot}`}
                    type="button"
                    className="btn btn--sm"
                    onClick={() => onMove('pilots', { slot })}
                  >
                    Piloto {slot + 1}
                  </button>
                ))
              : null}
          </Group>

          <Group label="Contadores">
            {COUNTER_KEYS.map((key) => {
              const value = instance?.counters[key] ?? 0;
              return (
                <span key={key} className="flex items-center gap-1">
                  <button
                    type="button"
                    className="step"
                    onClick={() => onCounter(key, value - 1)}
                    aria-label={`Reducir ${key}`}
                  >
                    −
                  </button>
                  <span className="hud-sub tabular w-14 text-center text-[10px]">
                    {key} {value}
                  </span>
                  <button
                    type="button"
                    className="step"
                    onClick={() => onCounter(key, value + 1)}
                    aria-label={`Aumentar ${key}`}
                  >
                    +
                  </button>
                </span>
              );
            })}
          </Group>

          <Group label="Retirar">
            <button type="button" className="btn btn--sm" onClick={onToHand}>
              A la mano
            </button>
            <button type="button" className="btn btn--sm" onClick={onToDeck}>
              Al mazo
            </button>
          </Group>
        </>
      )}
    </Panel>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="hud-sub mb-1.5 text-[9px]">{label}</p>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

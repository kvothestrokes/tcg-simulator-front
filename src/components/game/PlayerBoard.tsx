/**
 * La mitad del tablero de un jugador, exactamente con las zonas del wireframe:
 *
 *   ESTACIÓN ESPACIAL │ ZONA DE BATALLA          │ VACÍO
 *   ÁREA DE PILOTOS   │ ZONA DE RECURSOS + HEAT  │ MAZO
 *
 * El tablero del rival se dibuja con las filas invertidas (`mirrored`) para que
 * su Zona de Batalla quede pegada a la tuya, como en una mesa real. Solo se
 * invierte el ORDEN de las filas, nunca el texto: rotar las etiquetas 180° las
 * haría ilegibles.
 */

import { CardStack, CardTile } from './CardTile';
import { HeatGauge } from './HeatGauge';
import { Zone } from './Zone';
import type { DragPayload } from './dnd';
import { setDragPayload } from './dnd';
import { Meter, Stepper } from '../ui/Meter';
import { Panel, PanelSection } from '../ui/Panel';
import { StatusDot } from '../ui/StatusDot';
import {
  cardsInZone,
  PILOT_SLOTS,
  RESOURCE_MAX,
  type CardInstance,
  type PlayerState,
  type ZoneId,
} from '../../lib/game/types';

interface PlayerBoardProps {
  player: PlayerState | undefined;
  label: string;
  /** ¿Es tu tablero? Solo entonces se puede interactuar. */
  isOwner: boolean;
  /** Invierte el orden de las filas (tablero del rival). */
  mirrored: boolean;
  cardWidth: number;
  active: boolean;
  selectedUid?: string;
  /** Zonas resaltadas como destino válido de la carta seleccionada. */
  targetZones?: ZoneId[];
  onSelectCard: (card: CardInstance) => void;
  onDropCard: (payload: DragPayload, zone: ZoneId, slot?: number) => void;
  onZoneClick: (zone: ZoneId, slot?: number) => void;
  onHeatChange: (value: number) => void;
  onResourceChange: (value: number) => void;
  onDeckClick?: () => void;
}

export function PlayerBoard({
  player,
  label,
  isOwner,
  mirrored,
  cardWidth,
  active,
  selectedUid,
  targetZones = [],
  onSelectCard,
  onDropCard,
  onZoneClick,
  onHeatChange,
  onResourceChange,
  onDeckClick,
}: PlayerBoardProps) {
  // Con las filas invertidas, la fila «alta» pasa a ser la segunda.
  const rowTall = mirrored ? 2 : 1;
  const rowShort = mirrored ? 1 : 2;
  const rows = mirrored ? 'auto minmax(0, 1fr)' : 'minmax(0, 1fr) auto';

  const isTarget = (zone: ZoneId) => targetZones.includes(zone);

  const renderCard = (card: CardInstance) => (
    <CardTile
      key={card.uid}
      def={card.def}
      instance={card}
      width={cardWidth}
      selected={selectedUid === card.uid}
      draggable={isOwner}
      onClick={() => onSelectCard(card)}
      onDragStart={(event) =>
        setDragPayload(event, { uid: card.uid, source: 'board', from: card.zone })
      }
    />
  );

  const zoneCards = (zone: ZoneId) => cardsInZone(player, zone);
  const voidCards = zoneCards('void');
  const topOfVoid = voidCards[voidCards.length - 1];

  return (
    <section
      className="flex min-h-0 flex-1 flex-col gap-1.5 border-l-2 pl-1.5 transition-colors"
      style={{ borderColor: active ? 'var(--color-signal)' : 'transparent' }}
      aria-label={`Tablero de ${label}`}
    >
      {/* Identificación del jugador */}
      <header className="flex shrink-0 items-center gap-2 px-1">
        <StatusDot on={player?.connected ?? false} pulse={player?.connected} />
        <span
          className="hud-title text-[11px]"
          style={active ? { color: 'var(--color-signal)' } : undefined}
        >
          {label}
        </span>
        <span className="hud-sub">Asiento {player?.seat ?? '—'}</span>
        {player?.left ? <span className="hud-sub text-[#fda4af]">Abandonó</span> : null}
        {!player?.connected && !player?.left ? (
          <span className="hud-sub text-[var(--color-heat)]">Desconectado</span>
        ) : null}
        {active ? (
          <span className="hud-sub text-[var(--color-signal)]">● En turno</span>
        ) : null}
        <span className="ml-auto flex items-center gap-3">
          <span className="hud-sub tabular">Mano {player?.handCount ?? 0}</span>
          <span className="hud-sub tabular">Mazo {player?.deckCount ?? 0}</span>
        </span>
      </header>

      <div
        className="grid min-h-0 flex-1 gap-1.5"
        style={{ gridTemplateColumns: '180px minmax(0, 1fr) 150px', gridTemplateRows: rows }}
      >
        {/* --- ESTACIÓN ESPACIAL ------------------------------------------- */}
        <PanelSection
          title="Estación Espacial"
          titleSize="sm"
          cut={10}
          meta={zoneCards('station').length || undefined}
          className="min-h-0"
          bodyClassName="min-h-0"
          style={{ gridColumn: 1, gridRow: rowTall }}
        >
          <Zone
            zone="station"
            droppable={isOwner}
            highlighted={isTarget('station')}
            onDropCard={onDropCard}
            onClick={() => onZoneClick('station')}
            className="flex h-full flex-wrap content-start gap-1 p-1.5"
            emptyHint={zoneCards('station').length === 0 ? 'Área de estación' : undefined}
          >
            {zoneCards('station').map(renderCard)}
          </Zone>
        </PanelSection>

        {/* --- ZONA DE BATALLA --------------------------------------------- */}
        <PanelSection
          title="Zona de Batalla"
          titleSize="sm"
          cut={10}
          meta={zoneCards('battle').length || undefined}
          className="min-h-0"
          bodyClassName="min-h-0"
          style={{ gridColumn: 2, gridRow: rowTall }}
        >
          <Zone
            zone="battle"
            droppable={isOwner}
            highlighted={isTarget('battle')}
            onDropCard={onDropCard}
            onClick={() => onZoneClick('battle')}
            className="flex h-full flex-wrap content-start gap-1.5 p-2"
            emptyHint={zoneCards('battle').length === 0 ? 'Área de batalla' : undefined}
          >
            {zoneCards('battle').map(renderCard)}
          </Zone>
        </PanelSection>

        {/* --- VACÍO -------------------------------------------------------- */}
        <PanelSection
          title="Vacío"
          titleSize="sm"
          cut={10}
          meta={voidCards.length || undefined}
          className="min-h-0"
          bodyClassName="min-h-0"
          style={{ gridColumn: 3, gridRow: rowTall }}
        >
          <Zone
            zone="void"
            droppable={isOwner}
            highlighted={isTarget('void')}
            onDropCard={onDropCard}
            onClick={() => onZoneClick('void')}
            className="flex h-full items-center justify-center p-1.5"
          >
            {topOfVoid ? (
              <div className="relative">
                <CardTile
                  def={topOfVoid.def}
                  instance={topOfVoid}
                  width={Math.min(cardWidth * 1.1, 74)}
                  draggable={isOwner}
                  selected={selectedUid === topOfVoid.uid}
                  onClick={() => onSelectCard(topOfVoid)}
                  onDragStart={(event) =>
                    setDragPayload(event, { uid: topOfVoid.uid, source: 'board', from: 'void' })
                  }
                />
                <span className="hud-sub mt-1 block text-center text-[9px]">
                  {voidCards.length} carta{voidCards.length === 1 ? '' : 's'}
                </span>
              </div>
            ) : (
              <span className="hud-sub text-[9px] opacity-45">Pila de descarte</span>
            )}
          </Zone>
        </PanelSection>

        {/* --- ÁREA DE PILOTOS ---------------------------------------------- */}
        <PanelSection
          title="Área de Pilotos"
          titleSize="sm"
          cut={10}
          className="min-h-0"
          style={{ gridColumn: 1, gridRow: rowShort }}
        >
          <div className="flex gap-1.5">
            {Array.from({ length: PILOT_SLOTS }, (_, slot) => {
              const card = zoneCards('pilots').find((c) => c.slot === slot);
              return (
                <Zone
                  key={slot}
                  zone="pilots"
                  droppable={isOwner}
                  highlighted={isTarget('pilots')}
                  onDropCard={(payload) => onDropCard(payload, 'pilots', slot)}
                  onClick={() => onZoneClick('pilots', slot)}
                  className="flex flex-1 items-center justify-center p-1"
                >
                  {card ? (
                    <CardTile
                      def={card.def}
                      instance={card}
                      width={cardWidth * 0.82}
                      draggable={isOwner}
                      selected={selectedUid === card.uid}
                      onClick={() => onSelectCard(card)}
                      onDragStart={(event) =>
                        setDragPayload(event, { uid: card.uid, source: 'board', from: 'pilots' })
                      }
                    />
                  ) : (
                    <span
                      className="hud-sub text-center text-[8px] leading-tight opacity-45"
                      style={{ width: cardWidth * 0.82, aspectRatio: '5 / 7' }}
                    >
                      <span className="flex h-full items-center justify-center">Piloto</span>
                    </span>
                  )}
                </Zone>
              );
            })}
          </div>
        </PanelSection>

        {/* --- ZONA DE RECURSOS + PUNTOS + HEAT ------------------------------ */}
        <div
          className="flex min-w-0 gap-1.5"
          style={{ gridColumn: 2, gridRow: rowShort }}
        >
          <PanelSection
            title="Zona de Recursos"
            titleSize="sm"
            cut={10}
            meta={zoneCards('resources').length || undefined}
            className="min-w-0 flex-1"
            bodyClassName="min-h-0"
          >
            <Zone
              zone="resources"
              droppable={isOwner}
              highlighted={isTarget('resources')}
              onDropCard={onDropCard}
              onClick={() => onZoneClick('resources')}
              className="flex h-full items-center gap-1 overflow-x-auto p-1.5"
              emptyHint={
                zoneCards('resources').length === 0 ? 'Pila de recursos' : undefined
              }
            >
              {zoneCards('resources').map((card) => (
                <div key={card.uid} className="shrink-0">
                  <CardTile
                    def={card.def}
                    instance={card}
                    width={cardWidth * 0.78}
                    draggable={isOwner}
                    selected={selectedUid === card.uid}
                    onClick={() => onSelectCard(card)}
                    onDragStart={(event) =>
                      setDragPayload(event, { uid: card.uid, source: 'board', from: 'resources' })
                    }
                  />
                </div>
              ))}
            </Zone>
          </PanelSection>

          <Panel cut={10} className="w-[142px] shrink-0" innerClassName="flex flex-col justify-between px-2.5 py-2">
            <div className="flex items-baseline justify-between gap-2">
              <h4 className="hud-title text-[10px] leading-tight">
                Puntos de
                <br />
                Recurso
              </h4>
              <span className="tabular display text-lg leading-none">
                {player?.resourcePoints ?? 0}
              </span>
            </div>
            <Meter
              value={player?.resourcePoints ?? 0}
              max={RESOURCE_MAX}
              color="var(--color-signal)"
              className="my-1.5"
            />
            {isOwner ? (
              <Stepper
                value={player?.resourcePoints ?? 0}
                max={RESOURCE_MAX}
                onChange={onResourceChange}
                label="puntos de recurso"
              />
            ) : (
              <p className="hud-sub text-[9px]">Declarados por el rival</p>
            )}
          </Panel>

          <div className="w-[186px] shrink-0">
            <HeatGauge
              value={player?.heat ?? 0}
              editable={isOwner}
              onChange={onHeatChange}
              compact={!isOwner}
            />
          </div>
        </div>

        {/* --- MAZO ---------------------------------------------------------- */}
        <PanelSection
          title="Mazo"
          titleSize="sm"
          cut={10}
          className="min-h-0"
          style={{ gridColumn: 3, gridRow: rowShort }}
        >
          <Zone
            zone="deck"
            droppable={isOwner}
            highlighted={isTarget('deck')}
            onDropCard={onDropCard}
            className="flex h-full items-center justify-center p-1.5"
          >
            <CardStack
              count={player?.deckCount ?? 0}
              width={cardWidth * 0.85}
              label="Mazo"
              onClick={isOwner ? onDeckClick : undefined}
            />
          </Zone>
        </PanelSection>
      </div>
    </section>
  );
}

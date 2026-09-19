/**
 * Mitad del tablero de un jugador (reglamento 2.4):
 *
 *   ESTACIÓN + PILOTOS │ BATALLA (8 ranuras) │ VACÍO
 *                      │ RECURSOS + HEAT     │ MAZO
 */

import { CardStack, CardTile } from './CardTile';
import { HeatGauge } from './HeatGauge';
import { Zone } from './Zone';
import type { DragPayload } from './dnd';
import { setDragPayload } from './dnd';
import { PanelSection } from '../ui/Panel';
import { StatusDot } from '../ui/StatusDot';
import {
  BATTLE_SLOTS,
  cardsInZone,
  type CardInstance,
  type PlayerState,
  type ZoneId,
} from '../../lib/game/types';
import {
  attachedTo,
  damageOn,
  effectiveAttack,
  effectiveDefense,
  readyResources,
  shipInSlot,
} from '../../lib/game/rules';

interface PlayerBoardProps {
  player: PlayerState | undefined;
  label: string;
  isOwner: boolean;
  mirrored: boolean;
  cardWidth: number;
  active: boolean;
  selectedUid?: string;
  hoverUid?: string;
  targetZones?: ZoneId[];
  attackSourceUid?: string;
  onSelectCard: (card: CardInstance) => void;
  onHoverCard?: (card: CardInstance | null) => void;
  onDoubleClickCard?: (card: CardInstance) => void;
  onContextMenuCard?: (card: CardInstance, event: React.MouseEvent) => void;
  onDropCard: (payload: DragPayload, zone: ZoneId, slot?: number) => void;
  onZoneClick: (zone: ZoneId, slot?: number) => void;
  onHeatChange: (value: number) => void;
  onDeckClick?: () => void;
  onVoidClick?: () => void;
  onAttackTarget?: (card: CardInstance) => void;
}

export function PlayerBoard({
  player,
  label,
  isOwner,
  mirrored,
  cardWidth,
  active,
  selectedUid,
  hoverUid,
  targetZones = [],
  attackSourceUid,
  onSelectCard,
  onHoverCard,
  onDoubleClickCard,
  onContextMenuCard,
  onDropCard,
  onZoneClick,
  onHeatChange,
  onDeckClick,
  onVoidClick,
  onAttackTarget,
}: PlayerBoardProps) {
  const rowTall = mirrored ? 2 : 1;
  const rowShort = mirrored ? 1 : 2;
  const rows = mirrored ? 'auto minmax(0, 1fr)' : 'minmax(0, 1fr) auto';

  const isTarget = (zone: ZoneId) => targetZones.includes(zone);

  const tileWidth = (tipo: CardInstance['def']['tipo']) =>
    tipo === 'Estación' ? Math.round(cardWidth * 1.85) : cardWidth;

  const renderCard = (card: CardInstance, width?: number) => (
    <CardTile
      key={card.uid}
      def={card.def}
      instance={card}
      width={width ?? tileWidth(card.def.tipo)}
      selected={selectedUid === card.uid}
      draggable={isOwner}
      onClick={() => {
        if (attackSourceUid && onAttackTarget) {
          onAttackTarget(card);
          return;
        }
        onSelectCard(card);
      }}
      onDoubleClick={() => onDoubleClickCard?.(card)}
      onContextMenu={(event) => onContextMenuCard?.(card, event)}
      onPointerEnter={() => onHoverCard?.(card)}
      onPointerLeave={() => onHoverCard?.(null)}
      onDragStart={(event) =>
        setDragPayload(event, { uid: card.uid, source: 'board', from: card.zone })
      }
    />
  );

  const zoneCards = (zone: ZoneId) => cardsInZone(player, zone);
  const voidCards = zoneCards('void');
  const topOfVoid = voidCards[voidCards.length - 1];
  const station = zoneCards('station').filter((c) => c.def.tipo === 'Estación');
  const reservePilots = zoneCards('pilots');
  const resources = zoneCards('resources');

  return (
    <section
      className="flex min-h-0 flex-1 flex-col gap-1.5 border-l-2 pl-1.5 transition-colors"
      style={{ borderColor: active ? 'var(--color-signal)' : 'transparent' }}
      aria-label={`Tablero de ${label}`}
    >
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
        {active ? <span className="hud-sub text-[var(--color-signal)]">● En turno</span> : null}
        <span className="ml-auto flex items-center gap-3">
          <span className="hud-sub tabular">Mano {player?.handCount ?? 0}</span>
          <span className="hud-sub tabular">Mazo {player?.deckCount ?? 0}</span>
          <span className="hud-sub tabular">Recursos {readyResources(player).length}</span>
        </span>
      </header>

      <div
        className="grid min-h-0 flex-1 gap-1.5"
        style={{ gridTemplateColumns: '220px minmax(0, 1fr) 168px', gridTemplateRows: rows }}
      >
        <PanelSection
          title="Estación & Pilotos"
          titleSize="sm"
          cut={10}
          meta={(station.length + reservePilots.length) || undefined}
          className="min-h-0"
          bodyClassName="min-h-0"
          style={{ gridColumn: 1, gridRow: `1 / span 2` }}
        >
          <div className="flex h-full min-h-0 flex-col gap-1.5 overflow-auto p-1">
            <Zone
              zone="station"
              droppable={isOwner}
              highlighted={isTarget('station') || Boolean(attackSourceUid && !isOwner)}
              onDropCard={onDropCard}
              onClick={() => {
                const target = station[0];
                if (attackSourceUid && target && onAttackTarget) {
                  onAttackTarget(target);
                  return;
                }
                onZoneClick('station');
              }}
              className="flex min-h-[88px] flex-wrap content-start justify-center gap-1 p-1"
              emptyHint={station.length === 0 ? 'Estación' : undefined}
            >
              {station.map((card) => (
                <div key={card.uid} className="flex flex-col items-center gap-0.5">
                  {renderCard(card)}
                  <span className="hud-sub tabular text-[8px]">
                    PV {Math.max(0, (card.def.hp ?? card.def.hp_max ?? 0) - damageOn(card))}
                    /{card.def.hp_max ?? card.def.hp ?? 0}
                  </span>
                </div>
              ))}
            </Zone>
            <p className="hud-sub px-1 text-[8px]">Reserva de pilotos</p>
            <Zone
              zone="pilots"
              droppable={isOwner}
              highlighted={isTarget('pilots')}
              onDropCard={onDropCard}
              onClick={() => onZoneClick('pilots')}
              className="flex min-h-[72px] flex-wrap content-start gap-1 p-1"
              emptyHint={reservePilots.length === 0 ? 'Sin pilotos en reserva' : undefined}
            >
              {reservePilots.map((card) => (
                <div key={card.uid} className="shrink-0">
                  {renderCard(card, cardWidth * 0.72)}
                </div>
              ))}
            </Zone>
          </div>
        </PanelSection>

        <PanelSection
          title="Zona de Batalla"
          titleSize="sm"
          cut={10}
          meta={
            zoneCards('battle').filter((c) => !c.attachedTo && c.def.tipo === 'Nave').length ||
            undefined
          }
          className="min-h-0"
          bodyClassName="min-h-0"
          style={{ gridColumn: 2, gridRow: rowTall }}
        >
          <div className="grid h-full grid-cols-4 grid-rows-2 gap-1.5 p-1.5">
            {Array.from({ length: BATTLE_SLOTS }, (_, slot) => {
              const ship = shipInSlot(player, slot);
              const links = ship ? attachedTo(player, ship.uid) : [];
              return (
                <Zone
                  key={slot}
                  zone="battle"
                  droppable={isOwner}
                  highlighted={isTarget('battle')}
                  onDropCard={(payload) => onDropCard(payload, 'battle', slot)}
                  onClick={() => onZoneClick('battle', slot)}
                  className="flex min-h-0 flex-col items-center justify-center gap-0.5 p-1"
                  emptyHint={ship ? undefined : `${slot + 1}`}
                >
                  {ship ? (
                    <>
                      {renderCard(ship, cardWidth * 0.92)}
                      <span className="hud-sub tabular text-[8px]">
                        {effectiveAttack(player, ship)}/{effectiveDefense(player, ship)}
                        {damageOn(ship) ? ` · dmg ${damageOn(ship)}` : ''}
                        {ship.isToken ? ' · TKN' : ''}
                      </span>
                      {hoverUid === ship.uid && links.length > 0 ? (
                        <span className="hud-sub text-[7px] leading-tight">
                          {links.map((c) => c.def.nombre).join(' · ')}
                        </span>
                      ) : null}
                    </>
                  ) : null}
                </Zone>
              );
            })}
          </div>
        </PanelSection>

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
            onClick={() => (onVoidClick && voidCards.length ? onVoidClick() : onZoneClick('void'))}
            className="flex h-full items-center justify-center p-1.5"
          >
            {topOfVoid ? (
              <div className="relative">
                <CardTile
                  def={topOfVoid.def}
                  instance={topOfVoid}
                  width={Math.min(cardWidth, 110)}
                  draggable={isOwner}
                  selected={selectedUid === topOfVoid.uid}
                  onClick={() => onSelectCard(topOfVoid)}
                  onDoubleClick={() => onVoidClick?.()}
                  onContextMenu={(event) => onContextMenuCard?.(topOfVoid, event)}
                  onDragStart={(event) =>
                    setDragPayload(event, { uid: topOfVoid.uid, source: 'board', from: 'void' })
                  }
                />
                <span className="hud-sub mt-1 block text-center text-[9px]">
                  {voidCards.length} · click para ver
                </span>
              </div>
            ) : (
              <span className="hud-sub text-[9px] opacity-45">Pila de descarte</span>
            )}
          </Zone>
        </PanelSection>

        <div className="flex min-w-0 gap-1.5" style={{ gridColumn: 2, gridRow: rowShort }}>
          <PanelSection
            title="Zona de Recursos"
            titleSize="sm"
            cut={10}
            meta={resources.length || undefined}
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
              emptyHint={resources.length === 0 ? 'Sin recursos' : undefined}
            >
              {resources.map((card) => (
                <div key={card.uid} className="shrink-0">
                  {renderCard(card, cardWidth * 0.72)}
                </div>
              ))}
            </Zone>
          </PanelSection>
          <div className="w-[168px] shrink-0">
            <HeatGauge
              value={player?.heat ?? 0}
              editable={isOwner}
              onChange={onHeatChange}
              compact={!isOwner}
            />
          </div>
        </div>

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
              width={cardWidth * 0.82}
              label="Mazo"
              onClick={isOwner ? onDeckClick : undefined}
            />
          </Zone>
        </PanelSection>
      </div>
    </section>
  );
}

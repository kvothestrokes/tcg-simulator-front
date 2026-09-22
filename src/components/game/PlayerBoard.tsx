/**
 * Mitad del tablero de un jugador (reglamento 2.4).
 *
 * La Zona de Batalla es la principal, así que ocupa TODA la banda flexible
 * (flex-1) y nunca se colapsa. El resto de zonas —estación, pilotos, recursos,
 * calor, vacío y mazo— viven en un riel compacto de altura fija.
 *
 *   ┌ RIEL: estación · pilotos · recursos · calor · vacío · mazo ┐
 *   └ ZONA DE BATALLA (8 ranuras en una fila) — domina el alto ──┘
 *
 * En el rival (mirrored) el riel va arriba y la batalla abajo, para que las dos
 * zonas de batalla queden pegadas a la franja central.
 *
 * Las cartas de la batalla se DIMENSIONAN para caber: medimos la banda con un
 * ResizeObserver y calculamos el ancho de carta a partir del alto y del ancho
 * disponibles, así nunca hace falta scroll ni se recorta una carta.
 */

import { useEffect, useRef, useState } from 'react';

import { CardStack, CardTile } from './CardTile';
import { Zone } from './Zone';
import type { DragPayload } from './dnd';
import { setDragPayload } from './dnd';
import { Meter, Stepper } from '../ui/Meter';
import { PanelSection } from '../ui/Panel';
import { StatusDot } from '../ui/StatusDot';
import { CARD_SIZE_PORTRAIT } from '../../lib/card/getCardTypeFields';
import {
  BATTLE_SLOTS,
  cardsInZone,
  HEAT_MAX,
  HEAT_THRESHOLD,
  type CardInstance,
  type PlayerState,
  type ZoneId,
} from '../../lib/game/types';
import {
  attachedTo,
  damageOn,
  effectiveAttack,
  effectiveDefense,
  isRootShip,
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

/** Mide un elemento con ResizeObserver (solo lectura, sin efectos de juego). */
function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (box) setSize({ width: box.width, height: box.height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, size] as const;
}

const PORTRAIT_RATIO = CARD_SIZE_PORTRAIT.h / CARD_SIZE_PORTRAIT.w;
const BATTLE_GAP = 6;
const CELL_PADDING = 10;
const STAT_HEIGHT = 16;

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
  const isTarget = (zone: ZoneId) => targetZones.includes(zone);

  const [battleRef, battleSize] = useElementSize<HTMLDivElement>();

  // Ancho de carta de batalla que garantiza que 8 quepan a lo ancho y que la
  // carta (más su renglón de stats) quepa a lo alto. Se acota a cardWidth para
  // que en pantallas grandes no se agiganten.
  const byWidth =
    battleSize.width > 0
      ? (battleSize.width - BATTLE_GAP * (BATTLE_SLOTS - 1)) / BATTLE_SLOTS - CELL_PADDING
      : cardWidth;
  const byHeight =
    battleSize.height > 0 ? (battleSize.height - STAT_HEIGHT - 8) / PORTRAIT_RATIO : cardWidth;
  const battleW = Math.max(40, Math.min(cardWidth, Math.floor(Math.min(byWidth, byHeight))));

  const railCard = Math.round(cardWidth * 0.46);
  const stationW = Math.round(cardWidth * 1.0);
  const voidW = Math.round(cardWidth * 0.5);

  const renderCard = (card: CardInstance, width: number) => (
    <CardTile
      key={card.uid}
      def={card.def}
      instance={card}
      width={width}
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
  const battleCards = zoneCards('battle');
  const voidCards = zoneCards('void');
  const topOfVoid = voidCards[voidCards.length - 1];
  const station = zoneCards('station').filter((c) => c.def.tipo === 'Estación');
  const reservePilots = zoneCards('pilots');
  const resources = zoneCards('resources');
  const heat = player?.heat ?? 0;
  const overheated = heat >= HEAT_THRESHOLD;

  // Ocupante de un hueco: la nave raíz si la hay, o cualquier carta suelta que
  // se haya movido a ese hueco (estación, piloto, etc.). Así NUNCA desaparece
  // una carta al soltarla en la batalla.
  const occupantInSlot = (slot: number): CardInstance | undefined =>
    shipInSlot(player, slot) ??
    battleCards.find((card) => !card.attachedTo && card.slot === slot && !isRootShip(card));

  const battle = (
    <PanelSection
      title="Zona de Batalla"
      titleSize="sm"
      cut={10}
      tone={active ? 'active' : 'default'}
      meta={battleCards.filter((c) => !c.attachedTo && c.def.tipo === 'Nave').length || undefined}
      className="min-h-0 flex-1"
      bodyClassName="min-h-0"
    >
      <div
        ref={battleRef}
        className="grid h-full min-h-0 grid-cols-8 gap-1.5 overflow-hidden p-1.5"
      >
        {Array.from({ length: BATTLE_SLOTS }, (_, slot) => {
          const occ = occupantInSlot(slot);
          const isShip = Boolean(occ && occ.def.tipo === 'Nave' && !occ.attachedTo);
          const links = isShip && occ ? attachedTo(player, occ.uid) : [];
          return (
            <Zone
              key={slot}
              zone="battle"
              droppable={isOwner}
              overflow="overflow-hidden"
              highlighted={isTarget('battle')}
              onDropCard={(payload) => onDropCard(payload, 'battle', slot)}
              onClick={() => onZoneClick('battle', slot)}
              className="flex min-h-0 flex-col items-center justify-center gap-0.5 p-1"
              emptyHint={occ ? undefined : `${slot + 1}`}
            >
              {occ ? (
                <>
                  {renderCard(occ, battleW)}
                  {isShip ? (
                    <span className="hud-sub tabular text-[8px]">
                      {effectiveAttack(player, occ)}/{effectiveDefense(player, occ)}
                      {damageOn(occ) ? ` · dmg ${damageOn(occ)}` : ''}
                      {occ.isToken ? ' · TKN' : ''}
                    </span>
                  ) : damageOn(occ) ? (
                    <span className="hud-sub tabular text-[8px]">dmg {damageOn(occ)}</span>
                  ) : null}
                  {hoverUid === occ.uid && links.length > 0 ? (
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
  );

  const rail = (
    <div className="flex shrink-0 gap-1.5" style={{ height: 112 }}>
      <PanelSection
        title="Estación"
        titleSize="sm"
        cut={10}
        className="min-h-0 shrink-0"
        bodyClassName="min-h-0"
        style={{ width: Math.max(132, stationW + 24) }}
      >
        <Zone
          zone="station"
          droppable={isOwner}
          overflow="overflow-hidden"
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
          className="flex h-full items-center justify-center gap-1 p-1"
          emptyHint={station.length === 0 ? 'Estación' : undefined}
        >
          {station.map((card) => (
            <div key={card.uid} className="flex shrink-0 flex-col items-center gap-0.5">
              {renderCard(card, stationW)}
              <span className="hud-sub tabular text-[8px]">
                PV {Math.max(0, (card.def.hp ?? card.def.hp_max ?? 0) - damageOn(card))}/
                {card.def.hp_max ?? card.def.hp ?? 0}
              </span>
            </div>
          ))}
        </Zone>
      </PanelSection>

      <PanelSection
        title="Pilotos"
        titleSize="sm"
        cut={10}
        meta={reservePilots.length || undefined}
        className="min-h-0 min-w-0 flex-1"
        bodyClassName="min-h-0"
      >
        <Zone
          zone="pilots"
          droppable={isOwner}
          overflow="overflow-x-auto overflow-y-hidden"
          highlighted={isTarget('pilots')}
          onDropCard={onDropCard}
          onClick={() => onZoneClick('pilots')}
          className="flex h-full items-center gap-1 p-1"
          emptyHint={reservePilots.length === 0 ? 'Reserva de pilotos' : undefined}
        >
          {reservePilots.map((card) => (
            <div key={card.uid} className="shrink-0">
              {renderCard(card, railCard)}
            </div>
          ))}
        </Zone>
      </PanelSection>

      <PanelSection
        title="Recursos"
        titleSize="sm"
        cut={10}
        meta={resources.length ? `${readyResources(player).length}/${resources.length}` : undefined}
        className="min-h-0 min-w-0 flex-[1.4]"
        bodyClassName="min-h-0"
      >
        <Zone
          zone="resources"
          droppable={isOwner}
          overflow="overflow-x-auto overflow-y-hidden"
          highlighted={isTarget('resources')}
          onDropCard={onDropCard}
          onClick={() => onZoneClick('resources')}
          className="flex h-full items-center gap-1 p-1"
          emptyHint={resources.length === 0 ? 'Roba del mazo compartido' : undefined}
        >
          {resources.map((card) => (
            <div key={card.uid} className="shrink-0">
              {renderCard(card, railCard)}
            </div>
          ))}
        </Zone>
      </PanelSection>

      <PanelSection
        title="Calor"
        titleSize="sm"
        cut={10}
        tone={overheated ? 'danger' : 'default'}
        meta={
          <span style={{ color: overheated ? 'var(--color-heat-max)' : 'var(--color-heat)' }}>
            {heat}/{HEAT_MAX}
          </span>
        }
        className="min-h-0 shrink-0"
        bodyClassName="min-h-0"
        style={{ width: 168 }}
      >
        <div className="flex h-full flex-col justify-center gap-1.5 p-1">
          <Meter value={heat} max={HEAT_MAX} threshold={HEAT_THRESHOLD} color="var(--color-heat)" />
          {isOwner ? (
            <div className="flex items-center justify-between gap-2">
              <Stepper value={heat} max={HEAT_MAX} onChange={onHeatChange} label="calor" />
              <button
                type="button"
                className="btn btn--sm btn--ghost"
                onClick={() => onHeatChange(0)}
                disabled={heat === 0}
                title="Disipar todo el calor"
              >
                Purgar
              </button>
            </div>
          ) : (
            <p className="hud-sub text-[9px]">
              {overheated ? 'Sobrecalentado' : `Umbral ${HEAT_THRESHOLD}`}
            </p>
          )}
        </div>
      </PanelSection>

      <PanelSection
        title="Vacío"
        titleSize="sm"
        cut={10}
        meta={voidCards.length || undefined}
        className="min-h-0 shrink-0"
        bodyClassName="min-h-0"
        style={{ width: Math.max(88, voidW + 20) }}
      >
        <Zone
          zone="void"
          droppable={isOwner}
          overflow="overflow-hidden"
          highlighted={isTarget('void')}
          onDropCard={onDropCard}
          onClick={() => (onVoidClick && voidCards.length ? onVoidClick() : onZoneClick('void'))}
          className="flex h-full items-center justify-center p-1"
        >
          {topOfVoid ? (
            <CardTile
              def={topOfVoid.def}
              instance={topOfVoid}
              width={voidW}
              draggable={isOwner}
              selected={selectedUid === topOfVoid.uid}
              onClick={() => onSelectCard(topOfVoid)}
              onDoubleClick={() => onVoidClick?.()}
              onContextMenu={(event) => onContextMenuCard?.(topOfVoid, event)}
              onPointerEnter={() => onHoverCard?.(topOfVoid)}
              onPointerLeave={() => onHoverCard?.(null)}
              onDragStart={(event) =>
                setDragPayload(event, { uid: topOfVoid.uid, source: 'board', from: 'void' })
              }
            />
          ) : (
            <span className="hud-sub text-[9px] opacity-45">Descarte</span>
          )}
        </Zone>
      </PanelSection>

      <PanelSection
        title="Mazo"
        titleSize="sm"
        cut={10}
        meta={player?.deckCount ?? 0}
        className="min-h-0 shrink-0"
        bodyClassName="min-h-0"
        style={{ width: Math.max(88, voidW + 20) }}
      >
        <Zone
          zone="deck"
          droppable={isOwner}
          overflow="overflow-hidden"
          highlighted={isTarget('deck')}
          onDropCard={onDropCard}
          className="flex h-full items-center justify-center p-1"
        >
          <CardStack
            count={player?.deckCount ?? 0}
            width={voidW}
            label="Mazo"
            onClick={isOwner ? onDeckClick : undefined}
          />
        </Zone>
      </PanelSection>
    </div>
  );

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

      {mirrored ? (
        <>
          {rail}
          {battle}
        </>
      ) : (
        <>
          {battle}
          {rail}
        </>
      )}
    </section>
  );
}

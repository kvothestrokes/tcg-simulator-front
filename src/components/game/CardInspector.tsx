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
import { formatGearModifiers } from '../../lib/card/getCardTypeFields';
import { getFactionTheme } from '../../lib/card/getFactionTheme';
import { stripKeywordMarkers } from '../../lib/card/extractKeywords';
import {
  CARD_TYPE_LABEL,
  ZONE_LABEL,
  type CardDef,
  type CardInstance,
  type PlayerState,
  type ZoneId,
} from '../../lib/game/types';
import { attachedTo, COST_ZONES, effectiveAttack, effectiveDefense } from '../../lib/game/rules';

export type Selection =
  | { kind: 'hand'; card: PrivateCard }
  | { kind: 'board'; card: CardInstance; owned: boolean }
  | null;

interface CardInspectorProps {
  selection: Selection;
  hover?: CardInstance | null;
  owner?: PlayerState;
  ships?: CardInstance[];
  onClose: () => void;
  onEnlarge?: () => void;
  onPlay: (to: ZoneId, options?: { faceUp?: boolean; slot?: number; attachedTo?: string }) => void;
  onMove: (to: ZoneId, options?: { slot?: number }) => void;
  onTap: (tapped: boolean) => void;
  onFlip: (faceUp: boolean) => void;
  onCounter: (key: string, value: number) => void;
  onToHand: () => void;
  onToDeck: () => void;
  onDiscardFromHand: () => void;
  /** Hand card: why its cost can't be paid right now (null = affordable). */
  playBlock?: string | null;
  /** Hand Order: pay its cost and send it to the void. */
  onActivateOrder?: () => void;
  onLink?: (parentUid: string) => void;
  onUnlink?: () => void;
  onAttack?: () => void;
  onDestroy?: () => void;
}

const PLAY_TARGETS: ZoneId[] = ['battle', 'resources', 'pilots', 'void'];
const MOVE_TARGETS: ZoneId[] = ['battle', 'station', 'resources', 'pilots', 'void'];
const COUNTER_KEYS = ['daño', 'escudo', 'marca', 'carga'] as const;
const COUNTER_MAX = 99;

const COUNTER_HINT: Record<(typeof COUNTER_KEYS)[number], string> = {
  daño: 'Daño recibido. Al resolver un ataque, la nave cae si el daño llega a su DEF y la estación si llega a sus PV.',
  escudo: 'Marcador manual de escudo (no lo aplica ninguna regla automática).',
  marca: 'Marcador manual genérico.',
  carga: 'Marcador manual de carga (energía acumulada para efectos de carta).',
};

const ZONE_HINT: Partial<Record<ZoneId, string>> = {
  battle: 'A tu Zona de Batalla',
  station: 'A tu zona de Estación',
  resources: 'A tu Zona de Recursos',
  pilots: 'A tu reserva de pilotos',
  void: 'Al Vacío (pila de descarte pública)',
};

export function CardInspector({
  selection,
  hover,
  owner,
  ships = [],
  onClose,
  onEnlarge,
  onPlay,
  onMove,
  onTap,
  onFlip,
  onCounter,
  onToHand,
  onToDeck,
  onDiscardFromHand,
  playBlock = null,
  onActivateOrder,
  onLink,
  onUnlink,
  onAttack,
  onDestroy,
}: CardInspectorProps) {
  const display = hover ?? (selection?.kind === 'board' ? selection.card : undefined);
  const linked = display && owner ? attachedTo(owner, display.uid) : [];

  if (!selection && !hover) {
    return (
      <Panel tone="dim" cut={10} className="shrink-0" innerClassName="px-3 py-4">
        <p className="hud-sub text-[10px] leading-relaxed">
          Selecciona una carta para verla y actuar sobre ella. Pasa el cursor
          sobre una nave para ver piloto y gears enlazados.
        </p>
      </Panel>
    );
  }

  const def =
    hover?.def ??
    (selection?.kind === 'hand' ? selection.card.def : selection!.card.def);
  const instance =
    hover ?? (selection?.kind === 'board' ? selection.card : undefined);
  const editable = Boolean(selection) && (selection?.kind === 'hand' || selection?.owned);
  const theme = getFactionTheme(def.faccion);
  const previewWidth = def.tipo === 'Estación' ? 320 : 220;
  const combat =
    instance && owner && instance.def.tipo === 'Nave'
      ? `${effectiveAttack(owner, instance)}/${effectiveDefense(owner, instance)}`
      : null;

  return (
    <Panel cut={10} className="min-h-0 min-h-[280px] flex-[1.6]" innerClassName="flex flex-col gap-3 overflow-y-auto p-3">
      <header className="flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="hud-title text-xs leading-tight">{def.nombre}</h3>
            <p className="hud-sub mt-1 text-[9px]" style={{ color: theme.primary }}>
              {def.faccion}
            </p>
            <p className="hud-sub mt-0.5 text-[9px]">
              {CARD_TYPE_LABEL[def.tipo]}
              {def.tipo !== 'Estación' ? ` · Coste ${def.coste_recursos}` : ''}
              {combat ? ` · ${combat}` : def.tipo === 'Nave' ? ` · ${def.ataque ?? 0}/${def.escudo ?? 0}` : ''}
              {hover && selection ? ' · hover' : ''}
            </p>
          </div>
          <button
            type="button"
            className="step shrink-0"
            onClick={onClose}
            aria-label="Cerrar inspector"
            title="Cerrar el inspector y quitar la selección"
          >
            ×
          </button>
        </div>
        <div className="mx-auto">
          <CardTile
            def={def}
            instance={instance}
            width={previewWidth}
            onClick={onEnlarge}
          />
        </div>
        {onEnlarge ? (
          <button
            type="button"
            className="btn btn--sm w-full"
            onClick={onEnlarge}
            title="Abrir la carta a tamaño completo"
          >
            Ver grande
          </button>
        ) : null}
      </header>

      {linked.length > 0 ? (
        <Group label="Enlazadas">
          {linked.map((card) => (
            <span key={card.uid} className="hud-sub border border-[var(--color-stroke-faint)] px-1.5 py-0.5 text-[9px]">
              {card.def.tipo}: {card.def.nombre}
            </span>
          ))}
        </Group>
      ) : null}

      <TypeFacts def={def} />

      {def.texto_efecto ? (
        <p className="text-[11px] leading-relaxed text-[var(--color-ink-dim)]">
          {stripKeywordMarkers(def.texto_efecto)}
        </p>
      ) : null}

      {def.palabras_clave?.length ? (
        <div className="flex flex-wrap gap-1">
          {def.palabras_clave.map((keyword) => (
            <span
              key={keyword}
              className="hud-sub border border-[var(--color-stroke-faint)] px-1.5 py-0.5 text-[9px]"
            >
              {keyword}
            </span>
          ))}
        </div>
      ) : null}

      {!editable || !selection ? (
        <p className="hud-sub text-[9px] opacity-60">
          {selection ? 'Carta del rival: solo lectura.' : 'Pasa el cursor o selecciona para actuar.'}
        </p>
      ) : selection.kind === 'hand' ? (
        <>
          <p className="hud-sub text-[9px]">
            Coste al jugar en batalla, pilotos o estación: {def.coste_recursos} recurso
            {def.coste_recursos === 1 ? '' : 's'}
            {def.coste_heat ? ` · +${def.coste_heat} CC` : ''}. En Recursos o al Vacío es gratis.
          </p>
          {playBlock ? (
            <p className="text-[10px] leading-snug text-[#fda4af]" role="status">
              {playBlock}
            </p>
          ) : null}

          {def.tipo === 'Orden' ? (
            <Group label="Orden">
              <button
                type="button"
                className="btn btn--sm btn--primary"
                onClick={onActivateOrder}
                disabled={Boolean(playBlock) || !onActivateOrder}
                title={
                  playBlock
                    ? `No disponible: ${playBlock}`
                    : 'Paga su coste y la envía al Vacío'
                }
              >
                Activar orden
              </button>
            </Group>
          ) : null}

          <Group label="Jugar en">
            {PLAY_TARGETS.map((zone) => {
              const blocked = Boolean(playBlock) && COST_ZONES.includes(zone);
              return (
                <button
                  key={zone}
                  type="button"
                  className="btn btn--sm"
                  onClick={() => onPlay(zone)}
                  disabled={blocked}
                  title={
                    blocked
                      ? `No disponible: ${playBlock}`
                      : COST_ZONES.includes(zone)
                        ? `${ZONE_HINT[zone]}: paga ${def.coste_recursos} recurso${def.coste_recursos === 1 ? '' : 's'}${def.coste_heat ? ` y +${def.coste_heat} de calor` : ''}`
                        : `${ZONE_HINT[zone]} (gratis)`
                  }
                >
                  {ZONE_LABEL[zone]}
                </button>
              );
            })}
          </Group>

          {ships.length > 0 && (def.tipo === 'Piloto' || def.tipo === 'Gear') ? (
            <Group label="Enlazar a nave">
              {ships.map((ship) => (
                <button
                  key={ship.uid}
                  type="button"
                  className="btn btn--sm"
                  onClick={() => onLink?.(ship.uid)}
                  disabled={Boolean(playBlock)}
                  title={
                    playBlock
                      ? `No disponible: ${playBlock}`
                      : `Jugar enlazada a ${ship.def.nombre} (paga su coste)`
                  }
                >
                  {ship.def.nombre}
                </button>
              ))}
            </Group>
          ) : null}

          <Group label="Descartar">
            <button
              type="button"
              className="btn btn--sm btn--danger"
              onClick={onDiscardFromHand}
              title="Descarta la carta de tu mano al Vacío, sin pagar coste"
            >
              Al Vacío
            </button>
          </Group>
        </>
      ) : (
        <>
          <Group label="Estado">
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => onTap(!(instance?.tapped ?? false))}
              title={
                instance?.tapped
                  ? 'Enderezar: la carta vuelve a estar lista'
                  : 'Girar 90° (agotar): marca la carta como usada este turno'
              }
            >
              {instance?.tapped ? 'Enderezar' : 'Girar'}
            </button>
            <button
              type="button"
              className="btn btn--sm"
              onClick={() => onFlip(!(instance?.faceUp ?? true))}
              title={
                instance?.faceUp
                  ? 'Poner boca abajo: el rival deja de ver la carta'
                  : 'Poner boca arriba: la carta se revela a los dos'
              }
            >
              {instance?.faceUp ? 'Boca abajo' : 'Boca arriba'}
            </button>
            {instance?.def.tipo === 'Nave' ? (
              <button
                type="button"
                className="btn btn--sm btn--primary"
                onClick={onAttack}
                title="Declara un ataque: después elige una nave o la estación enemiga. Tu nave se agota y suma su ATK como daño al objetivo."
              >
                Atacar
              </button>
            ) : null}
            {instance?.attachedTo ? (
              <button
                type="button"
                className="btn btn--sm"
                onClick={onUnlink}
                title="Separa la carta de su nave: el piloto vuelve a la reserva y el gear a Recursos"
              >
                Desenganchar
              </button>
            ) : null}
          </Group>

          {ships.length > 0 && (instance?.def.tipo === 'Piloto' || instance?.def.tipo === 'Gear') ? (
            <Group label="Enlazar a">
              {ships.map((ship) => (
                <button
                  key={ship.uid}
                  type="button"
                  className="btn btn--sm"
                  onClick={() => onLink?.(ship.uid)}
                  title={`Enlazar a ${ship.def.nombre} (1 piloto y hasta 2 gears por nave)`}
                >
                  {ship.def.nombre}
                </button>
              ))}
            </Group>
          ) : null}

          <Group label="Mover a">
            {MOVE_TARGETS.filter((zone) => zone !== instance?.zone).map((zone) => (
              <button
                key={zone}
                type="button"
                className="btn btn--sm"
                onClick={() => onMove(zone)}
                title={`${ZONE_HINT[zone] ?? ZONE_LABEL[zone]}. Mover cartas ya en mesa es gratis.`}
              >
                {ZONE_LABEL[zone]}
              </button>
            ))}
          </Group>

          <Group label="Contadores">
            {COUNTER_KEYS.map((key) => {
              const value = instance?.counters[key] ?? 0;
              return (
                <span key={key} className="flex items-center gap-1" title={COUNTER_HINT[key]}>
                  <button
                    type="button"
                    className="step"
                    onClick={() => onCounter(key, Math.max(0, value - 1))}
                    disabled={value <= 0}
                    aria-label={`Reducir ${key}`}
                    title={value <= 0 ? `No disponible: ${key} ya está en 0` : `Quitar 1 de ${key}`}
                  >
                    −
                  </button>
                  <span className="hud-sub tabular w-14 text-center text-[10px]">
                    {key} {value}
                  </span>
                  <button
                    type="button"
                    className="step"
                    onClick={() => onCounter(key, Math.min(COUNTER_MAX, value + 1))}
                    disabled={value >= COUNTER_MAX}
                    aria-label={`Aumentar ${key}`}
                    title={`Añadir 1 de ${key}`}
                  >
                    +
                  </button>
                </span>
              );
            })}
          </Group>

          <Group label="Retirar">
            <button
              type="button"
              className="btn btn--sm"
              onClick={onToHand}
              title="Devuelve la carta a tu mano (lo enlazado queda suelto)"
            >
              A la mano
            </button>
            <button
              type="button"
              className="btn btn--sm"
              onClick={onToDeck}
              title="Devuelve la carta a tu mazo"
            >
              Al mazo
            </button>
            {instance?.def.tipo === 'Nave' ? (
              <button
                type="button"
                className="btn btn--sm btn--danger"
                onClick={onDestroy}
                title="Destruye la nave: va al Vacío, su piloto a la reserva y sus gears a Recursos"
              >
                Destruir
              </button>
            ) : null}
          </Group>
        </>
      )}
    </Panel>
  );
}

function TypeFacts({ def }: { def: CardDef }) {
  const rows: { label: string; value: string }[] = [];

  if (def.tipo !== 'Estación') {
    rows.push({ label: 'Heat', value: String(def.coste_heat) });
  }

  if (def.tipo === 'Nave') {
    if (def.rol) rows.push({ label: 'Rol', value: def.rol });
    rows.push({ label: 'Ataque', value: String(def.ataque ?? 0) });
    rows.push({ label: 'Escudo', value: String(def.escudo ?? 0) });
    rows.push({ label: 'Gear', value: String(def.espacios_gear ?? 0) });
    if (def.chatarra_al_morir) {
      rows.push({ label: 'Chatarra al morir', value: String(def.chatarra_al_morir) });
    }
  }

  if (def.tipo === 'Orden') {
    if (def.subtipo) rows.push({ label: 'Subtipo', value: def.subtipo });
    if (def.momento_juego) rows.push({ label: 'Momento', value: def.momento_juego });
  }

  if (def.tipo === 'Piloto') {
    if (def.requisito_enlace) rows.push({ label: 'Enlace', value: def.requisito_enlace });
    if (def.bono_al_enlazar) rows.push({ label: 'Enlazado', value: def.bono_al_enlazar });
    if (def.bono_sin_enlazar) rows.push({ label: 'Sin enlazar', value: def.bono_sin_enlazar });
  }

  if (def.tipo === 'Gear') {
    rows.push({ label: 'Ocupa', value: String(def.espacios_ocupa ?? 0) });
    if (def.restriccion_equipamiento) {
      rows.push({ label: 'Restricción', value: def.restriccion_equipamiento });
    }
    const mods = formatGearModifiers(def);
    if (mods) rows.push({ label: 'Mods', value: mods });
  }

  if (def.tipo === 'Estación') {
    if (def.rol) rows.push({ label: 'Rol', value: def.rol });
    rows.push({ label: 'HP', value: `${def.hp ?? 0} / ${def.hp_max ?? 0}` });
    rows.push({ label: 'Heat', value: `${def.heat_actual ?? 0} / ${def.heat_umbral ?? 0}` });
  }

  if (def.rareza) rows.push({ label: 'Rareza', value: def.rareza });
  if (def.numero_coleccion) rows.push({ label: 'Colección', value: def.numero_coleccion });

  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-[10px] text-[var(--color-ink-dim)]">
      {rows.map((row) => (
        <div key={row.label} className="contents">
          <dt className="hud-sub text-[8px]">{row.label}</dt>
          <dd className="min-w-0 leading-tight">{row.value}</dd>
        </div>
      ))}
    </dl>
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

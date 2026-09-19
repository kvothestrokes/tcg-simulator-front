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
import { attachedTo, effectiveAttack, effectiveDefense } from '../../lib/game/rules';

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
  onLink?: (parentUid: string) => void;
  onUnlink?: () => void;
  onAttack?: () => void;
  onDestroy?: () => void;
}

const PLAY_TARGETS: ZoneId[] = ['battle', 'resources', 'pilots', 'void'];
const MOVE_TARGETS: ZoneId[] = ['battle', 'station', 'resources', 'pilots', 'void'];
const COUNTER_KEYS = ['daño', 'escudo', 'marca'] as const;

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
          <button type="button" className="btn btn--sm w-full" onClick={onEnlarge}>
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

          {ships.length > 0 && (def.tipo === 'Piloto' || def.tipo === 'Gear') ? (
            <Group label="Enlazar a nave">
              {ships.map((ship) => (
                <button
                  key={ship.uid}
                  type="button"
                  className="btn btn--sm"
                  onClick={() => onLink?.(ship.uid)}
                >
                  {ship.def.nombre}
                </button>
              ))}
            </Group>
          ) : null}

          <Group label="Descartar">
            <button type="button" className="btn btn--sm btn--danger" onClick={onDiscardFromHand}>
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
            {instance?.def.tipo === 'Nave' ? (
              <button type="button" className="btn btn--sm btn--primary" onClick={onAttack}>
                Atacar
              </button>
            ) : null}
            {instance?.attachedTo ? (
              <button type="button" className="btn btn--sm" onClick={onUnlink}>
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
              >
                {ZONE_LABEL[zone]}
              </button>
            ))}
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
            {instance?.def.tipo === 'Nave' ? (
              <button type="button" className="btn btn--sm btn--danger" onClick={onDestroy}>
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

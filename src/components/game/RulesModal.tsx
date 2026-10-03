/**
 * "Reglamento" modal: a summary of the rules exactly as this client applies
 * them. Every number comes from the engine constants (types.ts / validation.ts)
 * so the text cannot drift from the reducer; the prose mirrors state.ts,
 * rules.ts and the README "Reglas automáticas" section.
 *
 * Esc or a click on the backdrop closes it.
 */

import { useEffect } from 'react';
import type { ReactNode } from 'react';

import { DECK_RULES } from '@/lib/decks/validation';
import {
  BATTLE_SLOTS,
  EXTRA_DRAW_HEAT,
  GEAR_MAX_PER_SHIP,
  HEAT_COOLDOWN,
  HEAT_MAX,
  HEAT_THRESHOLD,
  OPENING_HAND_SIZE,
  PHASES,
  PILOT_SLOTS,
  REVEAL_MAX,
  SHARED_RESOURCE_DECK_SIZE,
} from '@/lib/game/types';

interface RulesModalProps {
  onClose: () => void;
}

export function RulesModal({ onClose }: RulesModalProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="modal-backdrop p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rules-title"
      onClick={onClose}
    >
      <div
        className="modal-panel max-h-[85vh] w-full max-w-3xl overflow-y-auto p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="rules-title" className="hud-title text-sm">
              Reglamento
            </h2>
            <p className="hud-sub mt-1 text-[9px]">
              Así aplica las reglas este simulador. Lo marcado como automático lo hace el motor; el
              resto lo declaras tú.
            </p>
          </div>
          <button
            type="button"
            className="btn btn--sm"
            onClick={onClose}
            title="Cerrar el reglamento (Esc)"
            autoFocus
          >
            Cerrar
          </button>
        </header>

        <div className="grid gap-4 text-[12px] leading-relaxed text-[var(--color-ink-dim)] md:grid-cols-2">
          <Section title="Mazo" accent="var(--color-zone-player)">
            <li>
              {DECK_RULES.MAX_DECK_CARDS} cartas + 1 estación espacial (la estación no cuenta en las{' '}
              {DECK_RULES.MAX_DECK_CARDS}).
            </li>
            <li>Máximo {DECK_RULES.MAX_COPIES} copias de cada carta; la estación, 1 sola copia.</li>
            <li>
              En el hangar solo puedes entrar a una sala con un mazo legal. Al sentarte se baraja en
              tu navegador y robas la mano inicial de {OPENING_HAND_SIZE} (automático).
            </li>
            <li>Tu mano y tu mazo son privados: el rival solo ve cuántas cartas tienes.</li>
          </Section>

          <Section title="Zonas" accent="var(--color-zone-battle)">
            <li>
              <b>Estación</b>: tu base; sus PV son el objetivo final del rival.
            </li>
            <li>
              <b>Zona de Batalla</b>: {BATTLE_SLOTS} huecos para naves, con sus pilotos y gears enlazados.
            </li>
            <li>
              <b>Área de Pilotos</b>: reserva de hasta {PILOT_SLOTS} pilotos sin enlazar.
            </li>
            <li>
              <b>Recursos</b>: cartas que pagan costes (vertical = lista, girada = gastada).
            </li>
            <li>
              <b>Vacío</b>: descarte público; al entrar, una carta pierde sus contadores.
            </li>
            <li>
              <b>Mazo compartido de recursos</b>: {SHARED_RESOURCE_DECK_SIZE} cartas para los dos jugadores.
            </li>
          </Section>

          <Section title="Turno y fases" accent="var(--color-signal)">
            <li>{PHASES.join(' → ')}. Solo quien tiene el turno avanza la fase.</li>
            <li>
              <b>Inicial</b> (automático al empezar tu turno): enderezas todo, robas 1, −{HEAT_COOLDOWN}{' '}
              de calor y recibes 1 recurso del mazo compartido si queda y no lo recibiste ya este turno.
            </li>
            <li>
              <b>Activación</b> (automático): se enderezan tus cartas.
            </li>
            <li>
              <b>Principal</b> y <b>Final</b>: sin efectos automáticos; desde Final pasas el turno al rival.
            </li>
            <li>1 recurso del mazo compartido por turno. «⟳ Recurso» es solo un respaldo manual.</li>
          </Section>

          <Section title="Costes y calor" accent="var(--color-heat)">
            <li>
              Jugar desde la mano a Batalla, Pilotos o Estación (o enlazar a una nave) gira
              automáticamente tantos recursos listos como su coste y suma su coste de calor. Si no te
              alcanza, la jugada se bloquea.
            </li>
            <li>Jugar a Recursos, descartar al Vacío, mover cartas ya en mesa y los tokens son gratis.</li>
            <li>Las órdenes se usan con «Activar orden»: pagan su coste y van al Vacío.</li>
            <li>
              Calor de 0 a {HEAT_MAX}; el umbral de sobrecalentamiento es {HEAT_THRESHOLD}. Se enfría −
              {HEAT_COOLDOWN} al empezar tu turno.
            </li>
          </Section>

          <Section title="Acciones de mazo (tu turno)" accent="var(--color-zone-orders)">
            <li>
              <b>Robo extra</b>: roba 1 y suma +{EXTRA_DRAW_HEAT} de calor; una vez por turno y no con el
              calor al máximo.
            </li>
            <li>
              <b>Revelar 1–{REVEAL_MAX}</b>: solo tú ves las cartas y eliges para cada una mano, arriba, fondo
              o Vacío. Cancelar las deja arriba en su orden.
            </li>
            <li>
              <b>Moler</b>: la carta superior va al Vacío.
            </li>
            <li>
              <b>Reciclar</b>: si la carta superior es Nave o Gear va a Recursos como recurso listo; si no,
              al Vacío.
            </li>
          </Section>

          <Section title="Combate" accent="var(--color-zone-void)">
            <li>
              Cada nave admite 1 piloto y hasta {GEAR_MAX_PER_SHIP} gears; sus bonos se suman al ATK/DEF.
            </li>
            <li>
              Al atacar, tu nave se agota y su ATK se suma como daño al objetivo. Una nave cae si el daño
              llega a su DEF: va al Vacío, su piloto a la reserva y sus gears a Recursos.
            </li>
            <li>Los tokens que salen de la Zona de Batalla se retiran de la partida.</li>
            <li>Contadores: daño, escudo, marca y carga. Solo el daño lo usa una regla automática.</li>
          </Section>

          <Section title="Victoria" accent="var(--color-ok)" wide>
            <li>La estación rival recibe daño igual o mayor que sus PV.</li>
            <li>El rival tiene que robar o empezar su turno con el mazo vacío (a partir del turno 2).</li>
            <li>El rival concede.</li>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  accent,
  wide = false,
  children,
}: {
  title: string;
  accent: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <section
      className={`zone-accent ${wide ? 'md:col-span-2' : ''}`}
      style={{ ['--zone-accent' as string]: accent }}
    >
      <h3 className="hud-title mb-1.5 text-[11px]">{title}</h3>
      <ul className="list-disc space-y-1 pl-4 marker:text-[var(--color-ink-faint)]">{children}</ul>
    </section>
  );
}

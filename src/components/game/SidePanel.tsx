/**
 * Columna lateral: registro de la partida y chat.
 *
 * El registro se construye desde el mismo log de eventos que el tablero, así
 * que es literalmente el historial persistido: al reconectar, aparece completo.
 * El chat es un evento más y comparte numeración, por eso también se recupera.
 */

import { useEffect, useRef, useState, type SyntheticEvent } from 'react';

import { Panel } from '../ui/Panel';
import type { LogEntry } from '../../lib/game/types';

interface SidePanelProps {
  log: LogEntry[];
  myUserId: string | undefined;
  nameFor: (userId: string | undefined) => string;
  /**
   * Sustituye los nombres genéricos del motor (Piloto-XXXX) por los alias que
   * muestra la interfaz. El motor no los conoce: solo ve identificadores.
   */
  humanize: (text: string) => string;
  onSendChat: (message: string) => void;
  disabled: boolean;
}

type Tab = 'log' | 'chat';

export function SidePanel({
  log,
  myUserId,
  nameFor,
  humanize,
  onSendChat,
  disabled,
}: SidePanelProps) {
  const [tab, setTab] = useState<Tab>('log');
  const [message, setMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const entries = tab === 'chat' ? log.filter((entry) => entry.chat) : log;

  // Autoscroll al final cuando llegan entradas nuevas.
  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [entries.length, tab]);

  const submit = (event: SyntheticEvent) => {
    event.preventDefault();
    const text = message.trim();
    if (!text) return;
    onSendChat(text);
    setMessage('');
    setTab('chat');
  };

  return (
    <Panel cut={12} className="flex min-h-0 min-h-[140px] w-full flex-1" innerClassName="flex min-h-0 flex-col">
      <header className="flex shrink-0 gap-1 px-2 pt-2">
        <TabButton active={tab === 'log'} onClick={() => setTab('log')}>
          Registro
        </TabButton>
        <TabButton active={tab === 'chat'} onClick={() => setTab('chat')}>
          Chat
        </TabButton>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-1 overflow-y-auto px-2 py-2">
        {entries.length === 0 ? (
          <p className="hud-sub text-[9px] opacity-55">
            {tab === 'chat' ? 'Sin mensajes todavía.' : 'Sin movimientos todavía.'}
          </p>
        ) : (
          entries.map((entry) => (
            <LogRow
              key={entry.sequence}
              entry={entry}
              myUserId={myUserId}
              nameFor={nameFor}
              humanize={humanize}
            />
          ))
        )}
      </div>

      <form onSubmit={submit} className="scanline-top flex shrink-0 gap-1 p-2">
        <input
          className="field field--text py-1.5 text-xs"
          placeholder="Escribe al rival…"
          maxLength={1000}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          disabled={disabled}
        />
        <button type="submit" className="btn btn--sm shrink-0" disabled={disabled || !message.trim()}>
          Enviar
        </button>
      </form>
    </Panel>
  );
}

function LogRow({
  entry,
  myUserId,
  nameFor,
  humanize,
}: {
  entry: LogEntry;
  myUserId: string | undefined;
  nameFor: (userId: string | undefined) => string;
  humanize: (text: string) => string;
}) {
  const mine = entry.playerId === myUserId;

  if (entry.chat) {
    return (
      <p className="text-[11px] leading-snug">
        <span
          className="hud-sub mr-1 text-[9px]"
          style={{ color: mine ? 'var(--color-signal)' : 'var(--color-ink-dim)' }}
        >
          {mine ? 'Tú' : nameFor(entry.playerId)}:
        </span>
        <span className="text-[var(--color-ink)]">{entry.chat.message}</span>
      </p>
    );
  }

  return (
    <p className="flex gap-1.5 text-[10px] leading-snug text-[var(--color-ink-dim)]">
      <span className="tabular shrink-0 text-[var(--color-stroke-dim)]">
        {String(entry.sequence).padStart(3, '0')}
      </span>
      <span>{humanize(entry.text)}</span>
    </p>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`hud-title flex-1 border px-2 py-1 text-[10px] transition-colors ${
        active
          ? 'border-[var(--color-stroke)] bg-[rgba(255,255,255,0.08)] text-[var(--color-ink)]'
          : 'border-[var(--color-stroke-faint)] text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]'
      }`}
    >
      {children}
    </button>
  );
}

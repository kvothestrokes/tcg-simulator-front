/**
 * Barra superior de la mesa: identidad de la sala, estado de la conexión y
 * control de turno.
 *
 * El turno es una declaración, no una regla: el servidor no impide que nadie
 * actúe fuera de su turno. El indicador está para que las dos personas sepan
 * de quién es, igual que al girar un marcador en la mesa.
 */

import { useState } from 'react';

import { StatusDot } from '../ui/StatusDot';
import { Wordmark } from '../ui/Wordmark';
import { roomShareUrl } from '../../lib/config';
import type { ConnectionState } from '../../lib/realtime/client';

interface TopBarProps {
  code: string;
  connection: ConnectionState;
  latencyMs: number | null;
  status: string;
  turn: number;
  phase: string;
  isMyTurn: boolean;
  canAct: boolean;
  onFinish: () => void;
  onLeave: () => void;
}

const CONNECTION_LABEL: Record<ConnectionState, string> = {
  idle: 'Iniciando',
  connecting: 'Conectando',
  syncing: 'Sincronizando',
  connected: 'En línea',
  reconnecting: 'Reconectando',
  closed: 'Desconectado',
};

export function TopBar({
  code,
  connection,
  latencyMs,
  status,
  turn,
  phase,
  isMyTurn,
  canAct: _canAct,
  onFinish,
  onLeave,
}: TopBarProps) {
  const [copied, setCopied] = useState(false);
  const online = connection === 'connected';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(roomShareUrl(code));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Sin permisos de portapapeles el código sigue visible para copiarlo a mano.
    }
  };

  return (
    <header className="flex shrink-0 items-center gap-4 border-b border-[var(--color-stroke-faint)] px-3 py-1.5">
      <Wordmark size="sm" />

      <div className="flex items-center gap-2">
        <span className="hud-sub">Sala</span>
        <span className="display text-base tracking-[0.25em]">{code}</span>
        <button type="button" className="btn btn--sm btn--ghost" onClick={() => void copy()}>
          {copied ? 'Copiado' : 'Copiar enlace'}
        </button>
      </div>

      <div className="flex items-center gap-2">
        <StatusDot on={online} pulse={connection === 'syncing' || connection === 'reconnecting'} />
        <span className="hud-sub">{CONNECTION_LABEL[connection]}</span>
        {latencyMs !== null && online ? (
          <span className="hud-sub tabular text-[var(--color-ink-faint)]">{latencyMs} ms</span>
        ) : null}
      </div>

      <div className="ml-auto flex items-center gap-2">
        <span className="hud-sub tabular">Turno {turn}</span>
        <span
          className="hud-sub border border-[var(--color-stroke-faint)] px-2 py-0.5"
          style={isMyTurn ? { color: 'var(--color-signal)', borderColor: 'var(--color-signal)' } : undefined}
        >
          {phase}
        </span>

        <span className="mx-1 h-5 w-px bg-[var(--color-stroke-faint)]" aria-hidden="true" />

        <button
          type="button"
          className="btn btn--sm btn--danger"
          onClick={onFinish}
          disabled={status === 'finished'}
        >
          Terminar
        </button>
        <button type="button" className="btn btn--sm btn--ghost" onClick={onLeave}>
          Salir
        </button>
      </div>
    </header>
  );
}

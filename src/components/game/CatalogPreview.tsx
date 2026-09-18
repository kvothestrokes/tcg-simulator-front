import { CardTile } from './CardTile';
import { CardInspector } from './CardInspector';
import { SAMPLE_CATALOG } from '../../lib/game/cards';
import { useState } from 'react';
import type { CardDef } from '../../lib/game/types';

/**
 * Galería local para revisar el frame por tipo sin entrar a una sala.
 */
export function CatalogPreview() {
  const [selected, setSelected] = useState<CardDef>(SAMPLE_CATALOG[0]!);

  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-6 p-6">
      <header>
        <p className="hud-sub">Vista de desarrollo</p>
        <h1 className="hud-title text-lg">Catálogo CyberPunk</h1>
      </header>

      <div className="flex flex-wrap items-end gap-4">
        {SAMPLE_CATALOG.map((card) => (
          <CardTile
            key={card.id}
            def={card}
            width={card.tipo === 'Estación' ? 280 : 160}
            selected={selected.id === card.id}
            onClick={() => setSelected(card)}
          />
        ))}
      </div>

      <div className="max-w-sm">
        <CardInspector
          selection={{ kind: 'hand', card: { uid: selected.id, def: selected } }}
          onClose={() => setSelected(SAMPLE_CATALOG[0]!)}
          onPlay={() => undefined}
          onMove={() => undefined}
          onTap={() => undefined}
          onFlip={() => undefined}
          onCounter={() => undefined}
          onToHand={() => undefined}
          onToDeck={() => undefined}
          onDiscardFromHand={() => undefined}
        />
      </div>
    </main>
  );
}

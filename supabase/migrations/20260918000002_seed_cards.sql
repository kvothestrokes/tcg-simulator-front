-- Migration: seed_cards
-- Idempotent upsert of every SAMPLE_CATALOG entry from src/lib/game/cards.ts
-- into the cards table. Running this migration more than once is safe: ON CONFLICT
-- updates all columns to match the source, leaving row count unchanged.
--
-- Identity columns stored directly: id, nombre, tipo, faccion, rareza
-- All other CardDef fields are stored as JSON inside the `data` column.

insert into public.cards (id, nombre, tipo, faccion, rareza, data) values
(
  'cp_001',
  'Dron Desechable',
  'Nave',
  'CyberPunk',
  'Común',
  '{
    "rol": "Caza",
    "coste_recursos": 1,
    "coste_heat": 0,
    "ataque": 10,
    "escudo": 10,
    "espacios_gear": 0,
    "palabras_clave": ["Reactor frío", "Kamikaze"],
    "texto_efecto": "Al ser destruida, genera 1 chatarra adicional.",
    "chatarra_al_morir": 2,
    "numero_coleccion": "CP-001",
    "autor": "",
    "notas_diseno": "Coste de Heat 0: permite turnos de muchas acciones. Motor de chatarra base."
  }'::jsonb
),
(
  'cp_008',
  'Mercado Negro',
  'Orden',
  'CyberPunk',
  'Común',
  '{
    "subtipo": "Instantánea",
    "coste_recursos": 1,
    "coste_heat": 1,
    "momento_juego": "Tu turno",
    "palabras_clave": [],
    "texto_efecto": "Busca en tu mazo 1 Nave de coste 2 o menos, añádela a tu mano y baraja. Generas 1 chatarra.",
    "numero_coleccion": "CP-008",
    "autor": "",
    "notas_diseno": "BUSCADOR/tutor barato. Arranca el motor cuando la mano es mala."
  }'::jsonb
),
(
  'cp_012',
  'Kaze, Piloto de Desguace',
  'Piloto',
  'CyberPunk',
  'Rara',
  '{
    "coste_recursos": 2,
    "coste_heat": 1,
    "requisito_enlace": "Nave con rol Caza",
    "bono_al_enlazar": "+10 de Ataque y gana Ráfaga.",
    "bono_sin_enlazar": "Tus Naves generan 1 chatarra adicional al ser destruidas.",
    "palabras_clave": [],
    "numero_coleccion": "CP-012",
    "autor": "",
    "notas_diseno": "Flexible: agresivo enlazado, motor si no. Ráfaga premia el combate mutuo."
  }'::jsonb
),
(
  'cp_014',
  'Blindaje Reciclado',
  'Gear',
  'CyberPunk',
  'Común',
  '{
    "coste_recursos": 1,
    "coste_heat": 0,
    "espacios_ocupa": 1,
    "restriccion_equipamiento": "Cualquier Nave",
    "modificador_ataque": 0,
    "modificador_escudo": 20,
    "palabras_clave": ["Reactor frío"],
    "texto_efecto": "La Nave equipada gana +20 de Escudo. Al ser destruido este Gear, generas 1 chatarra.",
    "numero_coleccion": "CP-014",
    "autor": "",
    "notas_diseno": "Sube un Caza de 10 a 30 de Escudo y sobrevive al combate mutuo."
  }'::jsonb
),
(
  'cp_stn_k9',
  'Estación Chatarrera K-9',
  'Estación',
  'CyberPunk',
  'Común',
  '{
    "rol": "Base",
    "coste_recursos": 0,
    "coste_heat": 0,
    "hp": 20,
    "hp_max": 20,
    "heat_actual": 0,
    "heat_umbral": 8,
    "texto_efecto": "Descarta 3 de chatarra para curar 1 a la estación.",
    "numero_coleccion": "CP-STN",
    "autor": ""
  }'::jsonb
)
on conflict (id) do update set
  nombre  = excluded.nombre,
  tipo    = excluded.tipo,
  faccion = excluded.faccion,
  rareza  = excluded.rareza,
  data    = excluded.data;

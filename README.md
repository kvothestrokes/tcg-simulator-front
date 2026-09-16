# cosmic-breaker-web

Frontend del simulador de mesa virtual para Cosmic Breaker. Astro + React +
TypeScript + Tailwind, contra el servicio de tiempo real en Go y Supabase Auth.

**No implementa reglas del juego.** Los jugadores declaran lo que hacen y mueven
las cartas ellos mismos; la aplicación registra, transmite y dibuja. No hay
cálculo de daño, ni validación de jugadas, ni resolución de efectos — ni en el
servidor ni aquí.

---

## Cómo encaja todo

```
  Navegador                        Servicio Go                 Supabase
  ─────────                        ───────────                 ────────
  Supabase Auth ───── JWT ───────▶ verificación HS256
  REST          ─── crear/unir ──▶ /v1/rooms…          ──SQL──▶ rooms
  WebSocket     ─── declarar ────▶ orden + persistencia ──────▶ game_events
                ◀── eventos ─────

  Tablero compartido = reduce(eventos)      ← se reconstruye, no se guarda
  Mano y mazo        = solo en tu navegador ← nunca viajan
```

Tres ideas sostienen el diseño:

**1. El tablero es una función pura del log.** `src/lib/game/state.ts` recibe los
eventos en orden y devuelve el estado. Como el backend garantiza que los dos
jugadores reciben los mismos eventos en la misma secuencia, los dos llegan al
mismo tablero. Recargar la página, reconectar o reiniciar el servidor no pierden
nada: se vuelve a reproducir.

**2. No hay actualizaciones optimistas.** Al declarar una jugada, el tablero
cambia cuando el evento vuelve del servidor ya persistido. Son milisegundos, y a
cambio no existe ningún estado intermedio que pueda divergir entre los dos
jugadores ni código de reconciliación que mantener.

**3. La mano es lo único privado.** Vive en `localStorage` y se mueve en
respuesta a *tus* eventos ya confirmados (`src/hooks/usePrivateDeck.ts`). El
rival solo ve contadores: «Mano 5», «Mazo 25». Bajar una carta la revela, porque
el evento `PLAY` lleva la definición completa —así el rival puede dibujarla
aunque no comparta tu catálogo.

---

## Puesta en marcha

### Requisitos

- Node 20 o superior
- El servicio de tiempo real corriendo (`tcg-realtime`)

### 1. Configuración

```sh
cp .env.example .env
```

| Variable | Para qué |
|---|---|
| `PUBLIC_REALTIME_URL` | URL del servicio Go (`http://localhost:8080` en local) |
| `PUBLIC_SUPABASE_URL` | proyecto de Supabase |
| `PUBLIC_SUPABASE_ANON_KEY` | clave anónima — **solo esta llega al navegador** |
| `PUBLIC_DEV_AUTH` | `true` habilita «entrar como invitado» |

El JWT secret, la service role key y la `DATABASE_URL` **no** van aquí: viven
únicamente en el servicio Go.

### 2. Arrancar

```sh
npm install
npm run dev     # http://localhost:4321
```

### 3. Jugar sin montar Supabase

Con el backend en modo desarrollo:

```sh
# en el repo del backend
STORE_DRIVER=memory APP_ENV=development \
SUPABASE_JWT_SECRET=un-secreto-de-al-menos-32-caracteres-para-dev \
go run ./cmd/server
```

y `PUBLIC_DEV_AUTH=true` aquí. La pantalla de acceso ofrecerá «entrar como
invitado»: pide un JWT a `POST /v1/dev/token`, que solo existe con
`APP_ENV=development`. Abre dos navegadores (o una ventana de incógnito) para
jugar contra ti mismo.

---

## Rutas

| Ruta | Qué es |
|---|---|
| `/` | acceso: magic link de Supabase o invitado |
| `/lobby/` | hangar: crear sala, entrar por código, partidas recientes |
| `/room/?code=ABC123` | la mesa |

El código de sala viaja en la query porque la app se compila **estática** y no
necesita servidor. Si prefieres `/room/ABC123`, instala `@astrojs/vercel`, pon
`output: 'server'` en `astro.config.mjs` y renombra la página a
`src/pages/room/[code].astro`.

---

## Endpoints que se usan

Los seis del backend, sin dejarse ninguno:

| Endpoint | Dónde |
|---|---|
| `GET /health` | indicador de estado en acceso y hangar |
| `POST /v1/rooms` | crear sala |
| `GET /v1/rooms/{code}` | estado de las partidas recientes |
| `POST /v1/rooms/{code}/join` | entrar (también al abrir la mesa: es idempotente) |
| `POST /v1/rooms/{code}/finish` | botón «Terminar» |
| `WS /v1/ws/rooms/{code}` | toda la partida |
| `POST /v1/dev/token` | solo con `PUBLIC_DEV_AUTH=true` y backend en desarrollo |

---

## La mesa

Las zonas son las del wireframe, para los dos jugadores:

```
  RIVAL   ÁREA DE PILOTOS  │ ZONA DE RECURSOS · PUNTOS · HEAT │ MAZO
          ESTACIÓN         │ ZONA DE BATALLA                  │ VACÍO
  ─────────────────────────── línea de enfrentamiento ───────────────
  TÚ      ESTACIÓN         │ ZONA DE BATALLA                  │ VACÍO
          ÁREA DE PILOTOS  │ ZONA DE RECURSOS · PUNTOS · HEAT │ MAZO
```

El tablero del rival lleva las filas invertidas para que su Zona de Batalla
quede pegada a la tuya, como en una mesa real. Solo se invierte el orden de las
filas, nunca el texto: rotar las etiquetas 180° las haría ilegibles.

**Heat** es un medidor de 0 a 12 con umbral en 8 (`HEAT_MAX` y `HEAT_THRESHOLD`
en `src/lib/game/types.ts`). Lo declara cada jugador con los botones `+`/`−`;
al pasar el umbral el panel se pone rojo. Nadie lo sube solo ni dispara nada:
igual que un marcador físico, está para que los dos lo vean.

### Cómo se juega

- **Arrastrar** una carta de la mano o de una zona a otra.
- **Pulsar** una carta la selecciona y abre el inspector, con todas las acciones
  (girar, voltear, mover, contadores, devolver a la mano o al mazo). Es el camino
  táctil y accesible: nada depende de saber arrastrar.
- **Pulsar una zona** con una carta seleccionada la mueve ahí.
- El mazo, el turno y la fase se controlan desde la columna derecha y la barra
  superior.

El turno es una declaración más: el servidor no impide actuar fuera de turno.

---

## Estructura

```
src/
  pages/            index · lobby · room (Astro, estáticas)
  layouts/          Base.astro
  components/
    ui/             Panel, Meter, Wordmark, StatusDot   ← sistema de diseño
    auth/           SignIn
    lobby/          Lobby
    game/           GameTable, PlayerBoard, Zone, CardTile, HeatGauge,
                    Hand, CardInspector, SidePanel, TopBar
  hooks/
    useSession      identidad (Supabase o invitado)
    useGameRoom     REST + WebSocket + motor de estado
    usePrivateDeck  mano y mazo (privados, en local)
  lib/
    config          variables PUBLIC_*
    api             cliente REST de los endpoints del backend
    session         tokens: Supabase Auth o /v1/dev/token
    realtime/       protocolo y cliente WebSocket
    game/           types · cards · events · state (el motor)
  styles/global.css sistema de diseño (paneles biselados, zonas punteadas…)
```

---

## Cartas

El catálogo de ejemplo está en `src/lib/game/cards.ts`: 16 definiciones y un
mazo de 30. Para conectar las cartas reales, cambia el cuerpo de `loadCatalog()`
por la consulta a Supabase o al backend y deja la firma igual — ningún
componente cambia, porque todos conocen solo el tipo `CardDef`.

---

## Comprobaciones

```sh
npm run check   # astro check: 0 errores
npm run build   # salida estática en dist/
```

Verificado además con una partida real entre dos navegadores contra el backend:
crear sala, unirse, preparar mazos, robar, jugar una carta, subir el calor,
chatear, pasar turno y recargar la página para comprobar que el tablero se
reconstruye y la mano sobrevive.

---

## Despliegue

Salida estática: sirve `dist/` en cualquier hosting.

**Vercel**: importa el repositorio, framework Astro (lo detecta solo), build
`npm run build`, directorio `dist`. Define las variables `PUBLIC_*` en el
proyecto.

Después, en el backend, añade el dominio a `ALLOWED_ORIGINS`:

```ini
ALLOWED_ORIGINS=https://tuapp.vercel.app,https://tudominio.com
```

Sin eso, el handshake del WebSocket se rechaza por origen — y es intencional.

Y desactiva el modo invitado en producción:

```ini
PUBLIC_DEV_AUTH=false
```

(aunque lo dejaras activado, `/v1/dev/token` no existe con `APP_ENV=production`).

---

## Limitaciones conocidas

- **Pantallas estrechas**: la mesa necesita ~1180 px y por debajo hace scroll
  horizontal. Apilar dos tableros de cartas en una columna deja de parecerse a
  una mesa; una versión para móvil necesita otro diseño, no el mismo encogido.
- **Partidas muy largas**: al abrir la mesa se reproduce el historial completo.
  Con miles de eventos conviene guardar una instantánea del estado junto a su
  secuencia y reproducir solo a partir de ahí.
- **Mano en varios dispositivos**: si abres la misma partida en otro navegador,
  los contadores cuadran pero las cartas concretas de tu mano serán otras. Es
  inevitable: nunca salieron del navegador original.

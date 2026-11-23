# Plan de implementación — Voice Expense Tracker

Fuentes:

- Producto y reglas: doc **Voice Expense Tracker — Foundations** (https://claude.ai/artifact/G2wbWiKgTR9JhKqQie7Fr2)
- Diseño: design system **Voice Expense Tracker · C1 Azul noche celeste** (https://claude.ai/artifact/6pvELgxEMVH3URqawqaLRF)

Objetivo: PWA personal, dark-only, para Chrome Android. Hablas una frase → Gemini la convierte en movimientos → confirmas → se guarda en IndexedDB. Sin backend, sin login, gratis. **Requiere internet**: no hay modo offline.

---

## 0. Decisiones (cerradas)

| #   | Tema                            | Decisión                                                                                                                                                                                                               |
| --- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Tailwind                        | **v4, fijada en `tailwindcss@4.3.5` + `@tailwindcss/vite@4.3.5`** (última estable, publicada 2026-11-06). Los tokens van en `@theme` dentro del CSS; el `tailwind.config.ts` v3 del design system se traduce (Fase 1). |
| 2   | Fuentes (Inter, JetBrains Mono) | **Self-host con `@fontsource`**, no Google Fonts. La CSP queda en "solo origen + Gemini".                                                                                                                              |
| 3   | Modo offline                    | **No existe.** Sin service worker ni precache. Sin conexión, el mic y Gemini fallan con "Sin conexión" y botón "Reintentar".                                                                                           |
| 4   | Cliente Gemini                  | `fetch` directo a la Interactions API (`POST /v1beta/interactions`) con `response_format` (JSON Schema) y `store: false`. Sin SDK. Modelo `gemini-3.5-flash-lite` en `services/gemini.ts`.                             |
| 5   | Validación                      | **Zod** (lo pide el doc). Es la única dependencia "extra" además de Dexie e iconos.                                                                                                                                    |
| 6   | Idioma                          | Código e ids en inglés; textos de UI en español (es-CO). Categorías: id en inglés + label en español en `domain/categories.ts`.                                                                                        |
| 7   | Fechas al editar                | Se conservan `date` y `createdAt` del movimiento original; editar solo actualiza `updatedAt`. La fecha no se puede cambiar en modo edición.                                                                            |
| 8   | Backup JSON                     | **No hay botón de exportar.**                                                                                                                                                                                          |
| 9   | Ahorros + débito                | Una sola cuenta (lo asumido en el doc).                                                                                                                                                                                |
| 10  | Hosting                         | Vercel (headers de CSP fáciles con `vercel.json`).                                                                                                                                                                     |

---

## Fase 1 — Scaffold y design system

- `npm create vite@latest` (React + TS). `tsconfig`: `strict`, `noUncheckedIndexedAccess`.
- `tailwindcss@4.3.5` + `@tailwindcss/vite@4.3.5` (plugin en `vite.config.ts`; sin `tailwind.config.ts` ni PostCSS). Tokens del design system en `src/index.css`:

```css
@import 'tailwindcss';

@theme {
  --color-*: initial; /* solo los colores del design system */
  --color-surface-0: #0e1420;
  --color-surface-1: #141c2b;
  --color-surface-2: #1b2536;
  --color-line: #22304a;
  --color-ink: #e3e9f2;
  --color-ink-muted: #8e9bb0;
  --color-accent: #8ab4ff;
  --color-on-accent: #0e1420;
  --color-income: #5ccfb0;
  --color-expense: #ff8fa3;
  --color-transfer: #aeb9c9;
  --color-danger: #ff8fa3;

  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;

  --radius-md: 10px;
  --radius-lg: 22px;

  --text-amount-xl: 40px;
  --text-amount-xl--line-height: 44px;
  --text-amount-xl--letter-spacing: -1px;
  --text-amount-md: 16px;
  --text-amount-md--line-height: 22px;
  --text-amount-sm: 15px;
  --text-amount-sm--line-height: 20px;
  --text-title: 22px;
  --text-title--line-height: 28px;
  --text-transcript: 22px;
  --text-transcript--line-height: 33px;
  --text-body: 16px;
  --text-body--line-height: 22px;
  --text-label: 14px;
  --text-label--line-height: 20px;
  --text-caption: 12px;
  --text-caption--line-height: 16px;
}
```

Pill = `rounded-full`. Spacing por defecto de v4 ya es grid de 4 px (`p-4` = 16 px).

- `index.html`: `<html class="bg-surface-0 text-ink font-sans">`, `<meta name="theme-color" content="#0e1420">`, `lang="es-CO"`.
- `@fontsource/inter` (400, 500) y `@fontsource/jetbrains-mono` (400, 500), importados en `main.tsx`.
- `@tabler/icons-react` (outline).
- `manifest.webmanifest` a mano (nombre, iconos, `display: standalone`, colores `#0e1420`) para instalarla desde Chrome. Sin service worker.
- ESLint (+ react-hooks) + Prettier. Vitest.
- Versiones exactas en `package.json` (sin `^`) + lockfile. `npm audit` limpio.

**Listo cuando:** la app abre en el móvil con los colores y fuentes del design system y se puede instalar.

## Fase 2 — Dominio (puro, con tests)

`src/domain/`:

- `types.ts` — `MovementType`, `Movement`, `Account`, `Setting` (del doc, §4).
- `categories.ts` — categorías por tipo (`as const`), id + label es-CO.
- `accounts.ts` — `efectivo | nequi | daviplata | ahorros | otros`, default `otros`.
- `dateRule.ts` — `today()`, `yesterday()`, `resolveRelativeDate('today'|'yesterday')`, `isAllowedDate()`. Fecha local, no UTC.
- `balance.ts` — `balanceEffect(movement)` → `{ accountId: delta }[]`; `calculateMonthlyBalance(movements, month)` (ignora transferencias y deshabilitados).
- `validation.ts` — esquemas Zod: movimiento del formulario y respuesta de Gemini (monto entero > 0, categoría válida para el tipo, cuentas conocidas, `toAccountId` solo en transferencias y ≠ `accountId`).
- `format.ts` — `Intl.NumberFormat('es-CO')`, signo `+` / `−` (U+2212) con espacio fino, `$` solo en el balance grande.
- `grouping.ts` — split por mes y grupos Hoy / Ayer / Última semana / Resto del mes.

**Listo cuando:** Vitest cubre regla de fecha, efectos de balance (crear, editar, deshabilitar, transferencia), validación y agrupación.

## Fase 3 — Persistencia (Dexie)

`src/db/`:

- `db.ts` — `version(1).stores(...)` exactamente como el doc.
- `seed.ts` — cuentas con balance 0 si la tabla está vacía.
- `movementRepository.ts` (interfaz `MovementRepository`): `create`, `update`, `disable`, cada uno en **una transacción** `rw` sobre `movements` + `accounts`, usando `balanceEffect` (editar = revertir viejo + aplicar nuevo). `update` nunca toca `date` ni `createdAt`; solo pone `updatedAt = Date.now()`.
- `settingsRepository.ts` — `getApiKey`, `setApiKey`.

Hooks: `useMovements(filters)`, `useMonthlyBalance(month)`, `useAccounts()` con `useLiveQuery`.

**Listo cuando:** test de repositorio con `fake-indexeddb` confirma que los balances cuadran tras crear/editar/borrar.

## Fase 4 — Componentes (atomic design)

Leer el `README.md` y `preview.html` de cada componente en el design system antes de construirlo.

| Nivel     | Componentes                                                                                      |
| --------- | ------------------------------------------------------------------------------------------------ |
| Atoms     | `Button` (primary/secondary), `Amount`, `FilterChip`, `Input`, `Select`, `Icon`                  |
| Molecules | `MovementRow`, `SearchInput`, `DateChip`, `FilterBar`                                            |
| Organisms | `MicButton` (idle / grabando con halo + waveform), `AccountCard`, `MovementList`, `ConfirmModal` |
| Templates | `MainLayout` (contenido arriba, mic y nav abajo), `ModalLayout`                                  |

Reglas: atoms/molecules sin Dexie ni Gemini; táctiles ≥ 44 px; foco 2 px `accent`; `pressed` → `surface-2` / scale 0.98; sin sombras ni gradientes.

## Fase 5 — Formulario de movimiento (crear y editar)

- `MovementForm`: tipo, monto, categoría (filtrada por tipo), cuenta, cuenta destino (solo transferencia), descripción, fecha.
- Fecha: al **crear** (incluido "Sí, editar" antes de guardar) se elige Hoy/Ayer; al **editar** un movimiento guardado se muestra la fecha original como texto, no editable.
- Validación con el mismo esquema Zod; error en `danger` bajo el campo ("Falta el monto").
- Se reutiliza en: editar fila y "Sí, editar" del modal de confirmación.

## Fase 6 — Home y Cuentas

- Home: header con balance del mes (`amount-xl`) + totales ingreso/gasto; selector de mes; lista agrupada; filtros (rango de fechas, búsqueda en descripción/categoría, orden por monto ↑↓); tap en fila → editar con acción "Eliminar" (soft delete).
- Cuentas: 5 `AccountCard`; tap → modal que cambia **solo** el balance.
- Navegación inferior: Movimientos / Cuentas (estado en `App.tsx`, sin router salvo que haga falta).

## Fase 7 — Setup (primera vez)

- Si no hay `geminiApiKey` en `settings` → pantalla para pegarla + balances iniciales opcionales.
- Nunca en el código ni en `.env`.

## Fase 8 — Voz

- `services/speech.ts` (interfaz `SpeechService`): `webkitSpeechRecognition`, `lang = 'es-CO'`, `interimResults: true`, `continuous: true`; tap inicia, tap detiene. Manejar `onend` inesperado de Android (reiniciar mientras siga "grabando").
- `useRecorder()` expone `isRecording`, `transcript`, `start`, `stop`, `error`.
- Pantalla "Escuchando…" con transcript en vivo (`transcript` 22/33) y waveform `accent`.
- Sin soporte o permiso denegado → mensaje y enlace al formulario.

## Fase 9 — Parsing con Gemini + confirmación

- `services/gemini.ts` (interfaz `ParserService`): prompt de sistema con fecha de hoy, categorías por tipo, ids de cuenta, reglas §3 y jerga de montos ("20 mil", "veinte mil", "una luca" = 1.000, "un palo" = 1.000.000). `response_format` con `mime_type: application/json` + JSON Schema, `date` como enum `today|yesterday`; texto leído del step `model_output`.
- Respuesta → Zod → `resolveRelativeDate` → validación por movimiento.
- `ConfirmModal`: "Esto se va a guardar" + lista; inválidos con borde `danger`. "No, guardar" guarda todos en una transacción; "Sí, editar" abre el formulario por movimiento.
- Errores (sin conexión, cuota 429, JSON inválido): mensaje + "Reintentar", conservando el transcript. `rawText` se guarda en cada movimiento.
- API key inválida (Gemini responde 401 `authentication` o 403 `permission_denied`): se abre un modal para pegar una key nueva, que no se puede cerrar hasta que Gemini acepte la key. Después se reintenta con el mismo transcript.
- Test: el ejemplo del doc (suscripción Nequi + abono deuda desde Ahorros) produce 2 movimientos válidos (con respuesta mockeada).

## Fase 10 — Seguridad y deploy

- `vercel.json` con CSP: `default-src 'self'; connect-src 'self' https://generativelanguage.googleapis.com; font-src 'self'; img-src 'self' data:`; más `X-Content-Type-Options`, `Referrer-Policy`.
- Nada de `dangerouslySetInnerHTML`.
- `npm audit` antes del deploy.
- Deploy en Vercel → abrir en Chrome Android → "Instalar app" → prueba de punta a punta (voz, error sin conexión, edición conserva fecha, balances).

---

## Estructura final

```
src/
  domain/        types, categories, accounts, dateRule, balance, validation, format, grouping
  db/            db.ts, seed.ts, movementRepository.ts, settingsRepository.ts
  services/      speech.ts, gemini.ts
  hooks/         useMovements, useMonthlyBalance, useAccounts, useRecorder
  components/    atoms/ molecules/ organisms/ templates/
  features/      setup/ home/ confirm/ accounts/ form/
  index.css      @import "tailwindcss" + @theme con los tokens
  App.tsx        pantalla actual + gate de setup
```

## Fuera de alcance

WhatsApp, gráficas, tarjeta de crédito, multiusuario, sync en la nube, fechas futuras o anteriores a ayer, **modo offline**, **exportar JSON**.

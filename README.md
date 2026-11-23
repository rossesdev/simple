<div align="center">

<img src="public/icon.svg" alt="Simple Track" width="96" height="96" />

# Simple Track

**Registra tus ingresos, gastos y transferencias hablando.**

Dices una frase, Groq la transcribe y la convierte en movimientos, tú confirmas y queda guardado en tu teléfono.

![React](https://img.shields.io/badge/React-19-8ab4ff?style=flat-square&logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-8ab4ff?style=flat-square&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-8-8ab4ff?style=flat-square&logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/Tailwind-4-8ab4ff?style=flat-square&logo=tailwindcss&logoColor=white)
![PWA](https://img.shields.io/badge/PWA-iPhone_%7C_Android-5ccfb0?style=flat-square&logo=pwa&logoColor=white)

</div>

---

## Tabla de contenido

- [Qué hace](#qué-hace)
- [Cómo funciona](#cómo-funciona)
- [Empezar](#empezar)
- [Scripts](#scripts)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Modelo de datos](#modelo-de-datos)
- [Seguridad y privacidad](#seguridad-y-privacidad)
- [Deploy](#deploy)
- [Fuera de alcance](#fuera-de-alcance)

---

## Qué hace

|                          |                                                                                                                                                            |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🎙️ **Entrada por voz**   | Toca el micrófono y di algo como _"pagué 20 mil de Netflix con Nequi y aboné un palo a la deuda desde Ahorros"_. Funciona en iPhone, Android y escritorio. |
| 🤖 **Parsing con Groq**  | Convierte la frase en uno o varios movimientos. Entiende jerga colombiana de montos: _"20 mil"_, _"una luca"_ (1.000), _"un palo"_ (1.000.000).            |
| ✅ **Confirmación**      | Antes de guardar ves la lista de movimientos. Puedes guardar todo de una o editar cada uno. Los inválidos se marcan en rojo.                               |
| ✍️ **Formulario manual** | Crear y editar movimientos sin voz. Al editar se conservan la fecha y la fecha de creación originales.                                                     |
| 📊 **Balance del mes**   | Total del mes con ingresos y gastos, selector de mes, lista agrupada por _Hoy / Ayer / Última semana / Resto del mes_.                                     |
| 🔎 **Filtros**           | Rango de fechas, búsqueda por descripción o categoría y orden por monto.                                                                                   |
| 🏦 **Cuentas**           | Efectivo, Nequi, DaviPlata, Ahorros y Otros. Los saldos se actualizan solos con cada movimiento.                                                           |
| 📱 **Instalable**        | PWA en modo oscuro para iPhone y Android. Sin backend, sin login, gratis.                                                                                  |

> [!NOTE]
> La app **necesita internet**: la transcripción y el parsing los hace Groq. No hay modo offline. Sin conexión verás "Sin conexión" con un botón "Reintentar", que vuelve a enviar el audio o el texto sin que tengas que repetir la frase.

## Cómo funciona

```mermaid
flowchart LR
    A["🎙️ Audio<br/>MediaRecorder"] --> B["📝 Groq Whisper<br/>whisper-large-v3"]
    B --> C["🤖 Groq LLM<br/>JSON Schema estricto"]
    C --> D["🛡️ Zod<br/>+ regla de fecha"]
    D --> E["✅ Confirmar<br/>o editar"]
    E --> F[("💾 IndexedDB<br/>Dexie")]
```

1. **Grabación.** `services/audioRecorder.ts` graba el micrófono con `MediaRecorder` (webm/opus en Chrome, mp4 en Safari), corta solo a los 60 s y siempre suelta el micrófono al terminar. No usa el reconocimiento de voz del navegador, que falla en iPhone.
2. **Transcripción.** `services/groq.ts` manda el audio a Groq (`whisper-large-v3`, `language: es`, con vocabulario como Nequi, DaviPlata, luca, palo). Si no se escuchó nada, la app dice "No te escuché".
3. **Parsing.** El texto va a Groq (`openai/gpt-oss-20b`) con un JSON Schema estricto. Son llamadas directas a la API, sin SDK.
4. **Validación.** La respuesta pasa por Zod: monto entero mayor que 0, categoría válida para el tipo, cuentas conocidas. El modelo devuelve `today` o `yesterday` y la app lo convierte a una fecha local.
5. **Confirmación.** Revisas los movimientos, los guardas todos en una transacción o editas cada uno.
6. **Persistencia.** Cada crear, editar o eliminar actualiza el movimiento y los saldos de las cuentas en **una sola transacción** de Dexie.

## Empezar

### Requisitos

- Node.js 24 (la versión con la que se desarrolla)
- Una API key de Groq (gratis en [console.groq.com/keys](https://console.groq.com/keys)). Crea una solo para esta app.
- Un navegador con `MediaRecorder`: Safari en iPhone, Chrome en Android o escritorio

> [!TIP]
> En [Data Controls](https://console.groq.com/settings/data-controls) de Groq activa **Zero Data Retention** para que no guarde ni el audio ni el texto.

### Instalación

```bash
npm install
```

```bash
npm run dev
```

Abre `http://localhost:5173`. La primera vez la app pide tu API key de Groq y, si quieres, los saldos iniciales de cada cuenta.

> [!IMPORTANT]
> La API key **no va en el código ni en un `.env`**. Se pega en la app y se guarda solo en el IndexedDB de tu teléfono. Si Groq la rechaza, la app abre un modal para pegar una nueva y reintenta con el mismo audio o texto.

## Scripts

| Comando           | Qué hace                              |
| ----------------- | ------------------------------------- |
| `npm run dev`     | Servidor de desarrollo con Vite       |
| `npm run build`   | Revisa tipos (`tsc`) y genera `dist/` |
| `npm run preview` | Sirve `dist/` en local                |
| `npm test`        | Tests con Vitest                      |
| `npm run lint`    | ESLint                                |
| `npm run format`  | Prettier                              |

## Estructura del proyecto

```
src/
├── domain/        Lógica pura y con tests: tipos, categorías, cuentas,
│                  regla de fecha, balance, validación (Zod), formato, agrupación
├── db/            Dexie: esquema y repositorios (movimientos, cuentas, ajustes)
├── services/      audioRecorder.ts (grabación) y groq.ts (transcripción y parsing)
├── hooks/         useMovements, useMonthlyBalance, useAccounts,
│                  useRecorder, useVoiceEntry, useApiKey
├── components/    Atomic design
│   ├── atoms/        Button, Amount, Input, Select, FilterChip
│   ├── molecules/    MovementRow, SearchInput, FormField
│   ├── organisms/    MicButton, MovementForm, MovementList, ConfirmModal,
│   │                 ApiKeyModal, AccountCard, AccountBalanceModal, BottomNav
│   └── templates/    MainLayout, ModalLayout
├── features/      Pantallas: setup, home, accounts
├── index.css      Tailwind v4 + tokens del design system en @theme
└── App.tsx        Navegación y pantalla de setup inicial
```

Las capas tienen reglas claras: `domain/` no conoce React ni Dexie, y los atoms y molecules no conocen Dexie ni Groq.

## Modelo de datos

**Tipos de movimiento:** `income`, `expense` y `transfer`. Las transferencias mueven dinero entre dos cuentas, no tienen categoría y no cuentan en el balance del mes.

**Cuentas:** `efectivo`, `nequi`, `daviplata`, `ahorros` y `otros` (la cuenta por defecto).

<details>
<summary><b>Categorías</b></summary>

| Gastos                                                                                                                                   | Ingresos                               |
| ---------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| Comida y restaurantes, Mercado, Transporte, Vivienda, Servicios, Suscripciones, Salud, Entretenimiento, Compras, Mascotas, Deudas, Otros | Salario, Freelance, Apartamento, Otros |

Los ids están en inglés y los textos en español (`src/domain/categories.ts`).

</details>

<details>
<summary><b>Reglas de negocio</b></summary>

- Solo se registran movimientos de **hoy o ayer**, nunca fechas futuras.
- Los montos son enteros en pesos colombianos y se muestran con `Intl.NumberFormat('es-CO')`.
- Eliminar un movimiento lo deshabilita (soft delete) y revierte su efecto en los saldos.
- Editar revierte el efecto anterior y aplica el nuevo. `date` y `createdAt` nunca cambian; solo `updatedAt`.
- Cada movimiento guarda el texto original dictado (`rawText`).

</details>

## Seguridad y privacidad

- **Todo queda en tu teléfono.** No hay backend ni cuentas de usuario. Lo único que sale del dispositivo es el audio grabado y su texto, que van a Groq. Groq no guarda las peticiones por defecto, y con Zero Data Retention activo tampoco las retiene para revisar abusos.
- **CSP estricta** en [`vercel.json`](vercel.json): solo recursos del propio origen y conexiones a `api.groq.com`. También envía `X-Content-Type-Options: nosniff` y `Referrer-Policy: no-referrer`.
- **Fuentes self-hosted** con `@fontsource`, sin Google Fonts ni otros CDN.
- No se usa `dangerouslySetInnerHTML`.
- Versiones exactas en `package.json` y `npm audit` limpio.

## Deploy

La app se despliega en **Vercel**, que aplica los headers de [`vercel.json`](vercel.json).

```bash
npm audit
```

```bash
npx vercel --prod
```

Después, en Chrome Android: abre la URL → menú ⋮ → **Instalar app**. En iPhone: Safari → Compartir → **Agregar a inicio**. Instalada, Safari no vuelve a pedir el micrófono en cada carga.

**Checklist de prueba en el teléfono:**

- [ ] Dictar una frase con varios movimientos y guardarlos
- [ ] Tres grabaciones seguidas en iPhone funcionan todas
- [ ] Modo avión → aparece "Sin conexión" y "Reintentar" reenvía el audio
- [ ] Editar un movimiento conserva su fecha
- [ ] Los saldos de las cuentas cuadran después de crear, editar y eliminar

## Fuera de alcance

Fuera de esta versión: WhatsApp, gráficas, tarjeta de crédito, multiusuario, sincronización en la nube, fechas que no sean hoy o ayer, modo offline y exportar a JSON.

---

<div align="center">
<sub>Hecho para uso personal · Dark mode only · es-CO</sub>
</div>

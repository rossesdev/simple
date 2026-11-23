# Plan: cambiar Gemini + voz del navegador por Groq

Estado: **implementado** (falta verificación en dispositivos, tarea 7). Fecha: 2026-11-23.

## Por qué

1. **iPhone.** El reconocimiento de voz de Safari (`webkitSpeechRecognition`) falla de forma impredecible: errores `aborted` y `audio-capture: Source is stopped`, sesiones que no terminan, la segunda grabación que no funciona. Chrome en iPhone usa el mismo motor, así que no es alternativa.
2. **Privacidad.** En el plan gratis de Gemini, Google usa lo que envías para mejorar sus productos, y personas pueden leerlo. Groq no guarda las peticiones por defecto y deja activar Zero Data Retention (ZDR).

## Cómo queda el flujo

```
Antes:  micrófono → Safari/Chrome convierte voz a texto → Gemini (texto → JSON) → confirmar → guardar
Después: micrófono → la app graba audio → Groq Whisper (audio → texto) → Groq LLM (texto → JSON) → confirmar → guardar
```

- La app ya no usa el reconocimiento de voz del navegador. Solo graba audio con `MediaRecorder`, que funciona igual en iPhone, Android y escritorio.
- Son dos llamadas a Groq: primero la transcripción y después el parsing. El texto transcrito se guarda igual que hoy con cada movimiento, y "Reintentar" puede volver a parsear sin volver a mandar el audio.
- Se pierde el texto en vivo mientras hablas. La pantalla muestra "Escuchando…" con la onda animada y luego "Entendiendo…" con el spinner que ya existe.

## Datos verificados (2026-11-23)

| Tema | Dato | Fuente |
|---|---|---|
| CORS | `access-control-allow-origin: *` en `/audio/transcriptions` y `/chat/completions` (preflight probado). Se puede llamar directo desde el navegador, como hoy con Gemini. | prueba con `curl` |
| Transcripción | `POST https://api.groq.com/openai/v1/audio/transcriptions`, multipart: `file`, `model`, `language`, `prompt` (máx. 224 tokens), `response_format`, `temperature` | [speech-to-text](https://console.groq.com/docs/speech-to-text) |
| Modelos Whisper | `whisper-large-v3` (más preciso, WER 10,3 %) y `whisper-large-v3-turbo` (más rápido y barato, WER 12 %) | idem |
| Formatos de audio | flac, mp3, mp4, mpeg, mpga, m4a, ogg, wav, webm. Máx. 25 MB en plan gratis. Se factura mínimo 10 s por audio. | idem |
| Parsing | `POST https://api.groq.com/openai/v1/chat/completions`, header `Authorization: Bearer <key>` | [structured-outputs](https://console.groq.com/docs/structured-outputs) |
| JSON Schema estricto | `response_format: { type: "json_schema", json_schema: { name, strict: true, schema } }`. Solo en `openai/gpt-oss-20b`, `openai/gpt-oss-120b` (producción) y algunos modelos en preview. En modo estricto todos los campos van en `required` y cada objeto lleva `additionalProperties: false`. | idem, [models](https://console.groq.com/docs/models) |
| Errores | 401 key inválida, 403 sin permiso, 413 archivo muy grande, 429 límite, 5xx servidor. Cuerpo: `{ error: { message, type } }` | [errors](https://console.groq.com/docs/errors) |
| Privacidad | Sin retención por defecto. ZDR se activa en Data Controls y aplica a transcripción y chat. | [your-data](https://console.groq.com/docs/your-data) |

**Sin confirmar** (revisar al implementar):
- Los límites del plan gratis: las páginas de Models y Rate limits de Groq dan números distintos. Ver los reales en console.groq.com/settings/limits.
- Si el schema estricto acepta `enum` con `null`. Plan B: `anyOf: [{ type: "string", enum: [...] }, { type: "null" }]`.
- Si `gpt-oss-20b` acepta `reasoning_effort: "low"` para responder más rápido.
- Si Groq acepta tal cual lo que graba Safari iOS (`audio/mp4`) y lo que graba Chrome (`audio/webm;codecs=opus`). La lista de formatos los incluye, pero hay que probar con un archivo real.

## Decisiones propuestas

| Decisión | Propuesta | Por qué |
|---|---|---|
| Modelo de transcripción | `whisper-large-v3` | Los montos tienen que salir exactos. Para audios de pocos segundos la diferencia de velocidad con turbo no se nota. |
| Modelo de parsing | `openai/gpt-oss-20b` | Está en producción, soporta schema estricto y es el más rápido. Si se equivoca con la jerga colombiana, subir a `gpt-oss-120b`. |
| Idioma | `language: "es"` y un `prompt` con vocabulario: "Nequi, DaviPlata, luca, lucas, palo, mil, pesos" | Ayuda a Whisper a escribir bien los nombres propios y la jerga. |
| Grabación máxima | 60 s con corte automático | Limita el tamaño del archivo y el consumo de cuota. |
| Audio muy corto o silencio | Si dura menos de 0,5 s, o Whisper devuelve texto vacío, mostrar "No te escuché" | Whisper a veces inventa texto cuando hay silencio. El parsing con lista vacía ya se maneja hoy. |
| API key | Nueva entrada `groqApiKey` en IndexedDB. Al arrancar se borra la `geminiApiKey` vieja. | Sin key de Groq, la app muestra la pantalla de setup como la primera vez. |
| Micrófono | Al terminar, cerrar siempre todos los tracks de `getUserMedia` | Así iOS suelta el micrófono y la siguiente grabación funciona (el problema de la "segunda vez"). |

## Riesgos

- **Calidad del parsing.** `gpt-oss-20b` no está probado con el prompt actual. Mitigación: tests con frases reales, contra la API de verdad, antes de borrar Gemini.
- **Dos llamadas son más lentas que una.** Esperado: menos de 2 s en total, porque Groq es muy rápido. Medirlo en el teléfono.
- **El permiso de micrófono en Safari** se sigue pidiendo en cada carga de página. Es comportamiento de iOS: no se puede evitar desde la web, salvo instalando la app como PWA.
- **La key vive en el navegador**, igual que hoy con Gemini. Recomendar crear una key de Groq solo para esta app.

## Tareas

Cada tarea deja la app funcionando y con los tests pasando. El orden importa, salvo donde se indica.

### 1. Servicio de grabación de audio
- [x] Crear `src/services/audioRecorder.ts`: `start()` / `stop(): Promise<Blob>` con `getUserMedia` + `MediaRecorder`. Elegir el `mimeType` con `MediaRecorder.isTypeSupported` (`audio/webm;codecs=opus`, si no `audio/mp4`).
- [x] Mapear errores: `NotAllowedError` → `not-allowed`, `NotFoundError` → `no-microphone`, sin `MediaRecorder` → `unsupported`.
- [x] Cerrar todos los tracks al terminar o fallar. Corte automático a los 60 s.
- [x] Tests con `MediaRecorder` y `getUserMedia` falsos: inicio/fin, errores, tracks cerrados, corte a 60 s.

### 2. Servicio Groq (transcripción + parsing)
- [x] Crear `src/services/groq.ts` con `transcribe(audio, apiKey): Promise<string>` (multipart, `whisper-large-v3`, `language: "es"`, `prompt` de vocabulario, `response_format: "json"`).
- [x] `parse(transcript, apiKey, now)` sobre `/chat/completions` con `json_schema` estricto. Reusar `buildSystemPrompt` y adaptar el schema: `additionalProperties: false`, nulls con `anyOf` si hace falta.
- [x] Renombrar `ParserError` y sus tipos a algo neutral (por ejemplo `AiError`) y agregar `413` → `too-large`. 401/403 → `invalid-key`, 429 → `quota`, error de red → `network`.
- [x] Renombrar `parseGeminiResponse` → `parseModelResponse` en `domain/validation.ts` y sus tests (la lógica no cambia).
- [x] Tests con `fetch` falso, como `gemini.test.ts`: cuerpo multipart correcto, header `Authorization`, schema enviado, mapeo de errores, respuesta mal formada.
- [ ] Prueba manual contra Groq real (con una key de prueba tuya) de 10 frases típicas: "almuerzo 20 mil con Nequi", "me pagaron un palo en ahorros", "pasé 50 lucas de Nequi a DaviPlata", "ayer taxi 15 mil y almuerzo 18 mil"… Si falla, probar `gpt-oss-120b`.

### 3. Hook de grabación
- [x] Reescribir `useRecorder` sobre `audioRecorder`: mismo `toggle`, `isRecording` y `error`; `onFinish` recibe un `Blob` en vez de texto. Quitar `transcript` en vivo.
- [x] Mensajes de error en español para los nuevos casos.

### 4. Flujo de voz
- [x] `useVoiceEntry`: `submitAudio(blob)` → paso `transcribing` → `parsing` (con transcript) → `confirm`.
- [x] Si falla la transcripción, el estado `error` guarda el audio para que "Reintentar" lo vuelva a enviar. Si falla el parsing, reintenta solo con el texto, como hoy.
- [x] El paso `invalid-key` reintenta desde donde falló: audio o texto.
- [x] Si la transcripción viene vacía, mostrar "No te escuché. Intenta otra vez."

### 5. Pantallas
- [x] `HomePage`: quitar el texto en vivo; "Escuchando…" mientras graba; spinner (`isLoading`) durante `transcribing` y `parsing`; mostrar el texto transcrito al parsear.
- [x] `SetupPage` y `ApiKeyModal`: textos y link a `https://console.groq.com/keys`, etiqueta "API key de Groq".
- [x] `settingsRepository`: guardar en `groqApiKey` y borrar `geminiApiKey`.

### 6. Limpieza y configuración
- [x] Borrar `src/services/speech.ts`, `speech.test.ts`, `gemini.ts` y `gemini.test.ts`.
- [x] `vercel.json`: en el CSP, `connect-src 'self' https://api.groq.com` (quitar Google).
- [x] README: flujo nuevo, cómo crear la key de Groq, activar **Zero Data Retention** en Data Controls, la nota de privacidad, y que la app ya funciona en iPhone.
- [x] `npm run lint`, `npm test`, `npm run build`.

### 7. Verificación en dispositivos
- [ ] Simulador iPhone: grabar (con frase de `say` por el micrófono del Mac) → transcripción → confirmación. Usa una key de Groq de prueba que pegas tú.
- [ ] Tu iPhone real: tres grabaciones seguidas para confirmar que la segunda y la tercera funcionan.
- [ ] Un Android con Chrome, si tienes uno a mano.

**Se pueden hacer en paralelo:** las tareas 1 y 2 (no tocan los mismos archivos). Las tareas 3 a 7 dependen de esas dos.

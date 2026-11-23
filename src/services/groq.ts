import { ACCOUNT_IDS, ACCOUNT_NAMES, DEFAULT_ACCOUNT_ID } from '../domain/accounts';
import { EXPENSE_CATEGORY_LABELS, INCOME_CATEGORY_LABELS } from '../domain/categories';
import { RELATIVE_DAYS, today } from '../domain/dateRule';
import { MOVEMENT_TYPES } from '../domain/types';
import { type MovementDraft, parseModelResponse } from '../domain/validation';

/** Most accurate Whisper on Groq: amounts must come out exact. */
export const TRANSCRIPTION_MODEL = 'whisper-large-v3';
/** Production model with strict JSON Schema. Move to openai/gpt-oss-120b if parsing slips. */
export const PARSING_MODEL = 'openai/gpt-oss-20b';

/** OpenAI-compatible API. Docs: https://console.groq.com/docs */
const BASE_URL = 'https://api.groq.com/openai/v1';

/** Whisper spells proper names and slang right when it sees them first (max 224 tokens). */
const VOCABULARY = 'Nequi, DaviPlata, luca, lucas, palo, mil, pesos';

export type AiErrorKind =
  'invalid-key' | 'quota' | 'too-large' | 'network' | 'bad-response' | 'unknown';

export class AiError extends Error {
  constructor(readonly kind: AiErrorKind) {
    super(`Groq request failed: ${kind}`);
    this.name = 'AiError';
  }
}

export interface AiService {
  /** Audio → text. Empty string when nothing was said. Throws AiError. */
  transcribe(audio: Blob, apiKey: string): Promise<string>;
  /** One spoken sentence → movement drafts. Throws AiError. */
  parse(transcript: string, apiKey: string, now?: Date): Promise<MovementDraft[]>;
}

const CATEGORY_IDS = [
  ...new Set([...Object.keys(EXPENSE_CATEGORY_LABELS), ...Object.keys(INCOME_CATEGORY_LABELS)]),
];

const nullableEnum = (values: readonly string[]): object => ({
  anyOf: [{ type: 'string', enum: [...values] }, { type: 'null' }],
});

/** Strict mode: every field required, no extra properties, nullable values through anyOf. */
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    movements: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: [...MOVEMENT_TYPES] },
          amount: { type: 'integer' },
          category: nullableEnum(CATEGORY_IDS),
          accountId: { type: 'string', enum: [...ACCOUNT_IDS] },
          toAccountId: nullableEnum(ACCOUNT_IDS),
          description: { type: 'string' },
          date: { type: 'string', enum: [...RELATIVE_DAYS] },
        },
        required: ['type', 'amount', 'category', 'accountId', 'toAccountId', 'description', 'date'],
        additionalProperties: false,
      },
    },
  },
  required: ['movements'],
  additionalProperties: false,
};

function list(labels: Readonly<Record<string, string>>): string {
  return Object.entries(labels)
    .map(([id, label]) => `${id} (${label})`)
    .join(', ');
}

export function buildSystemPrompt(now: Date = new Date()): string {
  return [
    'You turn one sentence in Colombian Spanish into money movements for a personal expense tracker.',
    `Today is ${today(now)}.`,
    "Movement types: income (money received), expense (money spent or paid, including debt payments), transfer (money moved between the user's own accounts).",
    `Expense categories: ${list(EXPENSE_CATEGORY_LABELS)}.`,
    `Income categories: ${list(INCOME_CATEGORY_LABELS)}.`,
    'Transfers have category null.',
    `Accounts: ${ACCOUNT_IDS.map((id) => `${id} (${ACCOUNT_NAMES[id]})`).join(', ')}. "Ahorros" also means the savings account and its debit card.`,
    `If no payment method or account is mentioned, use ${DEFAULT_ACCOUNT_ID}.`,
    'For income, accountId is the account that receives the money. For transfers, accountId is the source and toAccountId the destination; toAccountId is null for anything else.',
    'date is "today" unless the sentence says yesterday ("ayer"). Never any other date.',
    'One sentence can contain several movements: return one item per movement.',
    'amount is an integer in Colombian pesos, no decimals. Colombian phrasing: "mil" = 1000 ("20 mil" = 20000, "veinte mil" = 20000), "una luca" = 1000, "dos lucas" = 2000, "un palo" = 1000000, "medio palo" = 500000, "20.000" = 20000 (dots are thousand separators).',
    'description: 1 to 4 words in Spanish, capitalized, naming what it was (e.g. "Almuerzo", "Suscripción", "Abono deuda apartamento").',
  ].join('\n');
}

/** Groq picks the decoder from the file extension: "audio/webm;codecs=opus" → "audio.webm". */
function fileName(audio: Blob): string {
  return `audio.${audio.type.split(/[/;]/)[1] || 'webm'}`;
}

export function createGroqService(fetchFn: typeof fetch = (...args) => fetch(...args)): AiService {
  async function post(
    path: string,
    apiKey: string,
    body: BodyInit,
    json = false,
  ): Promise<unknown> {
    let response: Response;
    try {
      response = await fetchFn(`${BASE_URL}${path}`, {
        method: 'POST',
        // The key goes in a header, never in the URL, so it stays out of logs and history.
        headers: {
          Authorization: `Bearer ${apiKey}`,
          ...(json ? { 'Content-Type': 'application/json' } : {}),
        },
        body,
      });
    } catch {
      throw new AiError('network');
    }
    if (!response.ok) throw new AiError(errorKind(response.status));
    try {
      return await response.json();
    } catch {
      throw new AiError('bad-response');
    }
  }

  return {
    async transcribe(audio, apiKey) {
      const form = new FormData();
      form.append('file', audio, fileName(audio));
      form.append('model', TRANSCRIPTION_MODEL);
      form.append('language', 'es');
      form.append('prompt', VOCABULARY);
      form.append('response_format', 'json');
      form.append('temperature', '0');
      const body = (await post('/audio/transcriptions', apiKey, form)) as { text?: unknown };
      if (typeof body?.text !== 'string') throw new AiError('bad-response');
      return body.text.trim();
    },

    async parse(transcript, apiKey, now = new Date()) {
      const body = (await post(
        '/chat/completions',
        apiKey,
        JSON.stringify({
          model: PARSING_MODEL,
          messages: [
            { role: 'system', content: buildSystemPrompt(now) },
            { role: 'user', content: transcript },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: { name: 'movements', strict: true, schema: RESPONSE_SCHEMA },
          },
          temperature: 0,
        }),
        true,
      )) as ChatResponse;

      let drafts: MovementDraft[] | null;
      try {
        const text = body?.choices?.[0]?.message?.content;
        drafts = text ? parseModelResponse(JSON.parse(text), now) : null;
      } catch {
        drafts = null;
      }
      if (!drafts) throw new AiError('bad-response');
      return drafts;
    },
  };
}

interface ChatResponse {
  choices?: { message?: { content?: string | null } }[];
}

/** Groq errors: `{ error: { message, type } }`. Docs: https://console.groq.com/docs/errors */
function errorKind(status: number): AiErrorKind {
  if (status === 401 || status === 403) return 'invalid-key';
  if (status === 413) return 'too-large';
  if (status === 429) return 'quota';
  return 'unknown';
}

export const groqService = createGroqService();

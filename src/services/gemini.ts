import { ACCOUNT_IDS, ACCOUNT_NAMES, DEFAULT_ACCOUNT_ID } from '../domain/accounts';
import { EXPENSE_CATEGORY_LABELS, INCOME_CATEGORY_LABELS } from '../domain/categories';
import { RELATIVE_DAYS, today } from '../domain/dateRule';
import { MOVEMENT_TYPES } from '../domain/types';
import { type MovementDraft, parseGeminiResponse } from '../domain/validation';

/** Free-tier, stable Flash-Lite model. */
export const GEMINI_MODEL = 'gemini-3.5-flash-lite';

/** Interactions API (replaces generateContent). Docs: https://aistudio.google.com/docs/interactions */
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/interactions';

export type ParserErrorKind = 'invalid-key' | 'quota' | 'network' | 'bad-response' | 'unknown';

export class ParserError extends Error {
  constructor(readonly kind: ParserErrorKind) {
    super(`Gemini parsing failed: ${kind}`);
    this.name = 'ParserError';
  }
}

export interface ParserService {
  /** Turns one spoken sentence into movement drafts. Throws ParserError. */
  parse(transcript: string, apiKey: string, now?: Date): Promise<MovementDraft[]>;
}

const CATEGORY_IDS = [
  ...new Set([...Object.keys(EXPENSE_CATEGORY_LABELS), ...Object.keys(INCOME_CATEGORY_LABELS)]),
];

/** Standard JSON Schema; nullable fields use a type array, as the Interactions docs show. */
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
          category: { type: ['string', 'null'], enum: [...CATEGORY_IDS, null] },
          accountId: { type: 'string', enum: [...ACCOUNT_IDS] },
          toAccountId: { type: ['string', 'null'], enum: [...ACCOUNT_IDS, null] },
          description: { type: 'string' },
          date: { type: 'string', enum: [...RELATIVE_DAYS] },
        },
        required: ['type', 'amount', 'category', 'accountId', 'toAccountId', 'description', 'date'],
      },
    },
  },
  required: ['movements'],
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

export function createGeminiParser(
  fetchFn: typeof fetch = (...args) => fetch(...args),
): ParserService {
  return {
    async parse(transcript, apiKey, now = new Date()) {
      let response: Response;
      try {
        response = await fetchFn(ENDPOINT, {
          method: 'POST',
          // The key goes in a header, never in the URL, so it stays out of logs and history.
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: JSON.stringify({
            model: GEMINI_MODEL,
            system_instruction: buildSystemPrompt(now),
            input: transcript,
            response_format: {
              type: 'text',
              mime_type: 'application/json',
              schema: RESPONSE_SCHEMA,
            },
            generation_config: { thinking_level: 'minimal' },
            // Stateless: Google keeps nothing (the default stores every interaction).
            store: false,
          }),
        });
      } catch {
        throw new ParserError('network');
      }

      if (!response.ok) throw new ParserError(errorKind(response));

      let drafts: MovementDraft[] | null;
      try {
        const body = (await response.json()) as InteractionResponse;
        const text =
          body.status === 'completed'
            ? body.steps
                ?.find((step) => step.type === 'model_output')
                ?.content?.map((item) => (item.type === 'text' ? (item.text ?? '') : ''))
                .join('')
            : undefined;
        drafts = text ? parseGeminiResponse(JSON.parse(text), now) : null;
      } catch {
        drafts = null;
      }
      if (!drafts) throw new ParserError('bad-response');
      return drafts;
    },
  };
}

interface InteractionResponse {
  status?: string;
  steps?: { type?: string; content?: { type?: string; text?: string }[] }[];
}

/** Interactions API errors: `{ error: { code, message } }` with snake_case codes. */
function errorKind(response: Response): ParserErrorKind {
  // 429 covers rate_limit_exceeded, quota_exceeded, too_many_requests and RESOURCE_EXHAUSTED.
  if (response.status === 429) return 'quota';
  // 401 authentication: key missing, invalid or expired. 403 permission_denied: key not allowed.
  if (response.status === 401 || response.status === 403) return 'invalid-key';
  return 'unknown';
}

export const geminiParser = createGeminiParser();

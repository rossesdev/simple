import { describe, expect, it, vi } from 'vitest';

import { buildSystemPrompt, createGeminiParser, ParserError } from './gemini';

const now = new Date(2026, 10, 23, 12, 0);

function interaction(text: string, status = 'completed'): Response {
  return new Response(
    JSON.stringify({
      id: 'i1',
      status,
      steps: [
        { type: 'thought', summary: [] },
        { type: 'model_output', content: [{ type: 'text', text }] },
      ],
    }),
    { status: 200 },
  );
}

function geminiReply(movements: unknown[]): Response {
  return interaction(JSON.stringify({ movements }));
}

async function kindOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return 'resolved';
  } catch (error) {
    return error instanceof ParserError ? error.kind : 'other';
  }
}

describe('gemini parser', () => {
  it('calls the Interactions API statelessly and parses the Foundations example', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      geminiReply([
        {
          type: 'expense',
          amount: 120000,
          category: 'subscriptions',
          accountId: 'nequi',
          toAccountId: null,
          description: 'Suscripción',
          date: 'today',
        },
        {
          type: 'expense',
          amount: 20000,
          category: 'debts',
          accountId: 'ahorros',
          toAccountId: null,
          description: 'Abono deuda apartamento',
          date: 'yesterday',
        },
      ]),
    );
    const drafts = await createGeminiParser(fetchFn).parse('me gasté…', 'test-key', now);

    expect(drafts.map((d) => [d.amount, d.accountId, d.date])).toEqual([
      [120000, 'nequi', '2026-11-23'],
      [20000, 'ahorros', '2026-11-22'],
    ]);
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/interactions');
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('test-key');
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      model: 'gemini-3.5-flash-lite',
      input: 'me gasté…',
      store: false,
      response_format: { type: 'text', mime_type: 'application/json' },
    });
    expect(body.system_instruction).toContain('Today is 2026-11-23');
  });

  it('maps HTTP errors', async () => {
    const parse = (response: Response): Promise<unknown> =>
      createGeminiParser(vi.fn().mockResolvedValue(response)).parse('x', 'k', now);

    const error = (code: string, status: number): Response =>
      new Response(JSON.stringify({ error: { code, message: code } }), { status });

    expect(await kindOf(parse(error('authentication', 401)))).toBe('invalid-key');
    expect(await kindOf(parse(error('permission_denied', 403)))).toBe('invalid-key');
    expect(await kindOf(parse(error('quota_exceeded', 429)))).toBe('quota');
    expect(await kindOf(parse(error('invalid_request', 400)))).toBe('unknown');
    expect(await kindOf(parse(new Response('{}', { status: 429 })))).toBe('quota');
    expect(await kindOf(parse(new Response('{}', { status: 500 })))).toBe('unknown');
  });

  it('reports network failures and bad replies', async () => {
    const offline = createGeminiParser(vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    expect(await kindOf(offline.parse('x', 'k', now))).toBe('network');

    const garbage = createGeminiParser(vi.fn().mockResolvedValue(interaction('no json')));
    expect(await kindOf(garbage.parse('x', 'k', now))).toBe('bad-response');

    const empty = createGeminiParser(vi.fn().mockResolvedValue(geminiReply([])));
    expect(await kindOf(empty.parse('x', 'k', now))).toBe('bad-response');

    const incomplete = createGeminiParser(
      vi.fn().mockResolvedValue(interaction('{"movements":[', 'incomplete')),
    );
    expect(await kindOf(incomplete.parse('x', 'k', now))).toBe('bad-response');
  });

  it('puts today and the rules in the prompt', () => {
    const prompt = buildSystemPrompt(now);
    expect(prompt).toContain('Today is 2026-11-23');
    expect(prompt).toContain('un palo');
    expect(prompt).toContain('otros');
  });
});

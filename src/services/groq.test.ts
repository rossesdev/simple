import { describe, expect, it, vi } from 'vitest';

import { AiError, buildSystemPrompt, createGroqService } from './groq';

const now = new Date(2026, 10, 23, 12, 0);

function chat(content: string | null): Response {
  return new Response(JSON.stringify({ choices: [{ message: { role: 'assistant', content } }] }), {
    status: 200,
  });
}

function reply(movements: unknown[]): Response {
  return chat(JSON.stringify({ movements }));
}

async function kindOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
    return 'resolved';
  } catch (error) {
    return error instanceof AiError ? error.kind : 'other';
  }
}

const groqError = (status: number): Response =>
  new Response(JSON.stringify({ error: { message: 'x', type: 'x' } }), { status });

describe('groq transcription', () => {
  it('sends the audio as multipart with the Spanish settings', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ text: ' almuerzo 20 mil ' })));
    const audio = new Blob(['bytes'], { type: 'audio/webm;codecs=opus' });

    expect(await createGroqService(fetchFn).transcribe(audio, 'test-key')).toBe('almuerzo 20 mil');

    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.groq.com/openai/v1/audio/transcriptions');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-key');
    // fetch sets the multipart boundary itself.
    expect((init.headers as Record<string, string>)['Content-Type']).toBeUndefined();
    const form = init.body as FormData;
    expect((form.get('file') as File).name).toBe('audio.webm');
    expect(form.get('model')).toBe('whisper-large-v3');
    expect(form.get('language')).toBe('es');
    expect(form.get('prompt')).toContain('Nequi');
  });

  it('names Safari recordings mp4', async () => {
    const fetchFn = vi.fn().mockResolvedValue(new Response(JSON.stringify({ text: '' })));
    const audio = new Blob(['bytes'], { type: 'audio/mp4' });

    expect(await createGroqService(fetchFn).transcribe(audio, 'k')).toBe('');
    const form = (fetchFn.mock.calls[0] as [string, RequestInit])[1].body as FormData;
    expect((form.get('file') as File).name).toBe('audio.mp4');
  });

  it('maps errors', async () => {
    const transcribe = (response: Response | Error): Promise<unknown> =>
      createGroqService(
        response instanceof Error
          ? vi.fn().mockRejectedValue(response)
          : vi.fn().mockResolvedValue(response),
      ).transcribe(new Blob(['x']), 'k');

    expect(await kindOf(transcribe(groqError(413)))).toBe('too-large');
    expect(await kindOf(transcribe(groqError(401)))).toBe('invalid-key');
    expect(await kindOf(transcribe(new TypeError('Failed to fetch')))).toBe('network');
    expect(await kindOf(transcribe(new Response('{}')))).toBe('bad-response');
    expect(await kindOf(transcribe(new Response('not json')))).toBe('bad-response');
  });
});

describe('groq parser', () => {
  it('calls chat completions with the strict schema and parses the Foundations example', async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      reply([
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
    const drafts = await createGroqService(fetchFn).parse('me gasté…', 'test-key', now);

    expect(drafts.map((d) => [d.amount, d.accountId, d.date])).toEqual([
      [120000, 'nequi', '2026-11-23'],
      [20000, 'ahorros', '2026-11-22'],
    ]);
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-key');
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      model: 'openai/gpt-oss-20b',
      messages: [{ role: 'system' }, { role: 'user', content: 'me gasté…' }],
      response_format: { type: 'json_schema', json_schema: { name: 'movements', strict: true } },
    });
    expect(body.messages[0].content).toContain('Today is 2026-11-23');
    const schema = body.response_format.json_schema.schema;
    const item = schema.properties.movements.items;
    expect(schema.additionalProperties).toBe(false);
    expect(item.additionalProperties).toBe(false);
    expect(item.required).toEqual(Object.keys(item.properties));
  });

  it('maps HTTP errors', async () => {
    const parse = (response: Response): Promise<unknown> =>
      createGroqService(vi.fn().mockResolvedValue(response)).parse('x', 'k', now);

    expect(await kindOf(parse(groqError(401)))).toBe('invalid-key');
    expect(await kindOf(parse(groqError(403)))).toBe('invalid-key');
    expect(await kindOf(parse(groqError(429)))).toBe('quota');
    expect(await kindOf(parse(groqError(400)))).toBe('unknown');
    expect(await kindOf(parse(groqError(500)))).toBe('unknown');
  });

  it('reports network failures and bad replies', async () => {
    const offline = createGroqService(vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    expect(await kindOf(offline.parse('x', 'k', now))).toBe('network');

    const withReply = (response: Response): Promise<unknown> =>
      createGroqService(vi.fn().mockResolvedValue(response)).parse('x', 'k', now);
    expect(await kindOf(withReply(chat('no json')))).toBe('bad-response');
    expect(await kindOf(withReply(chat(null)))).toBe('bad-response');
    expect(await kindOf(withReply(reply([])))).toBe('bad-response');
    expect(await kindOf(withReply(new Response('{}')))).toBe('bad-response');
  });

  it('puts today and the rules in the prompt', () => {
    const prompt = buildSystemPrompt(now);
    expect(prompt).toContain('Today is 2026-11-23');
    expect(prompt).toContain('un palo');
    expect(prompt).toContain('otros');
  });
});

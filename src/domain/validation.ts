import { z } from 'zod';

import { ACCOUNT_IDS } from './accounts';
import { type Category, isCategoryValidForType } from './categories';
import { isAllowedNewDate, RELATIVE_DAYS, resolveRelativeDay } from './dateRule';
import { MOVEMENT_TYPES, type Movement } from './types';

/** The fields a person (form) or the AI (parsed sentence) provides for one movement. */
export type MovementInput = Pick<
  Movement,
  'type' | 'amount' | 'category' | 'accountId' | 'toAccountId' | 'description' | 'date'
>;

/** Unvalidated movement as it comes from the AI or a form, shown for correction when invalid. */
export interface MovementDraft {
  type: Movement['type'];
  amount: number;
  category: string | null;
  accountId: string;
  toAccountId?: string;
  description: string;
  date: string;
}

export type MovementFieldErrors = Partial<Record<keyof MovementInput, string>>;

/** A draft plus what is wrong with it (empty when valid), as shown in the confirmation modal. */
export interface DraftWithErrors {
  draft: MovementDraft;
  errors: MovementFieldErrors;
}

export type MovementValidation =
  { success: true; data: MovementInput } | { success: false; errors: MovementFieldErrors };

const movementInputSchema = z
  .object({
    type: z.enum(MOVEMENT_TYPES, { error: 'Elige el tipo' }),
    amount: z
      .number({ error: 'Falta el monto' })
      .int('El monto no lleva decimales')
      .positive('Falta el monto'),
    category: z.string().nullable(),
    accountId: z.enum(ACCOUNT_IDS, { error: 'Elige una cuenta' }),
    toAccountId: z.enum(ACCOUNT_IDS, { error: 'Elige una cuenta' }).optional(),
    description: z.string().trim().min(1, 'Falta la descripción').max(120, 'Descripción muy larga'),
    date: z.iso.date('Fecha inválida'),
  })
  .superRefine((movement, ctx) => {
    if (!isCategoryValidForType(movement.type, movement.category)) {
      const message =
        movement.type === 'transfer'
          ? 'Las transferencias no llevan categoría'
          : 'Elige una categoría';
      ctx.addIssue({ code: 'custom', path: ['category'], message });
    }
    if (movement.type !== 'transfer') {
      if (movement.toAccountId) {
        ctx.addIssue({
          code: 'custom',
          path: ['toAccountId'],
          message: 'Solo las transferencias llevan cuenta destino',
        });
      }
      return;
    }
    if (!movement.toAccountId) {
      ctx.addIssue({ code: 'custom', path: ['toAccountId'], message: 'Elige la cuenta destino' });
    } else if (movement.toAccountId === movement.accountId) {
      ctx.addIssue({
        code: 'custom',
        path: ['toAccountId'],
        message: 'La cuenta destino debe ser otra',
      });
    }
  });

/**
 * Validates a movement before it touches the DB.
 * `isNew` applies the today/yesterday rule; edits keep their original date.
 */
export function validateMovementInput(
  input: unknown,
  options: { isNew: boolean; now?: Date },
): MovementValidation {
  const result = movementInputSchema.safeParse(input);
  const errors: MovementFieldErrors = {};

  if (!result.success) {
    for (const issue of result.error.issues) {
      const field = issue.path[0] as keyof MovementInput | undefined;
      if (field && !errors[field]) errors[field] = issue.message;
    }
  }
  if (options.isNew && !errors.date) {
    const date = (input as { date?: unknown } | null)?.date;
    if (typeof date !== 'string' || !isAllowedNewDate(date, options.now)) {
      errors.date = 'Solo se puede registrar hoy o ayer';
    }
  }

  if (!result.success || Object.keys(errors).length > 0) return { success: false, errors };
  // The refine above guarantees the category matches the type.
  return {
    success: true,
    data: { ...result.data, category: result.data.category as Category | null },
  };
}

/** Shape of the model's JSON. Values are checked again per movement with validateMovementInput. */
const modelResponseSchema = z.object({
  movements: z
    .array(
      z.object({
        type: z.enum(MOVEMENT_TYPES),
        amount: z.number(),
        category: z.string().nullable(),
        accountId: z.string(),
        toAccountId: z.string().nullable(),
        description: z.string(),
        date: z.enum(RELATIVE_DAYS),
      }),
    )
    .min(1)
    .max(10),
});

/** Parses the model's untrusted JSON into drafts. Returns null when the shape is wrong. */
export function parseModelResponse(json: unknown, now: Date = new Date()): MovementDraft[] | null {
  const result = modelResponseSchema.safeParse(json);
  if (!result.success) return null;
  return result.data.movements.map(({ toAccountId, date, ...movement }) => ({
    ...movement,
    ...(toAccountId ? { toAccountId } : {}),
    date: resolveRelativeDay(date, now),
  }));
}

/** Validates a new movement draft for the confirmation modal. */
export function checkDraft(draft: MovementDraft, now: Date = new Date()): DraftWithErrors {
  const result = validateMovementInput(draft, { isNew: true, now });
  return { draft, errors: result.success ? {} : result.errors };
}

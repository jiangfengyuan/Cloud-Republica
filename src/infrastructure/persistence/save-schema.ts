import { z } from 'zod';

export const CURRENT_SAVE_SCHEMA_VERSION = 2;
export const CURRENT_CONTENT_VERSION = 1;

const historyEntrySchema = z.object({
  command: z.string(),
  payload: z.record(z.string(), z.unknown())
});

const cardIdSchema = z.number().int();

const legacyCardSchema = z.object({
  id: cardIdSchema,
  uid: z.number().int()
}).passthrough();

const legacyTimedEffectSchema = z.object({
  cardId: cardIdSchema,
  turnsLeft: z.number().int().positive()
}).passthrough();

// Shape checks mirror the legacy engine's validState (js/game-session.js) so a
// corrupted snapshot fails migration instead of being carried into v2. Content
// references (card/event/tech ids) are validated against the live database by
// the loader, not here.
const legacyStateSchema = z.object({
  difficulty: z.string(),
  faction: z.string(),
  phase: z.enum(['event', 'action', 'settlement']),
  gameOver: z.literal(false),
  rngState: z.number().int(),
  nextCardUid: z.number().int(),
  resources: z.object({
    money: z.number().finite(),
    materials: z.number().finite(),
    energy: z.number().finite(),
    research: z.number().finite(),
    morale: z.number().finite(),
    integrity: z.number().finite()
  }),
  hand: z.array(legacyCardSchema),
  permanentCards: z.array(legacyCardSchema),
  drawPile: z.array(cardIdSchema),
  discardPile: z.array(cardIdSchema),
  selectedCards: z.array(z.number().int().nonnegative()),
  techs: z.array(z.string()),
  timedEffects: z.array(legacyTimedEffectSchema),
  delayedEffects: z.array(legacyTimedEffectSchema),
  pendingEvent: z.object({ id: cardIdSchema }).passthrough().nullish(),
  maturedIncome: z.object({
    money: z.number().finite(),
    materials: z.number().finite(),
    energy: z.number().finite(),
    research: z.number().finite(),
    morale: z.number().finite()
  })
}).passthrough();

export const legacyActiveGameSchema = z.object({
  v: z.literal(1),
  state: legacyStateSchema,
  history: z.array(historyEntrySchema)
});

// runFormat pins the shape of `run`: 'legacy' keeps the legacy state shape
// (cards {id, uid}, timedEffects keyed by cardId). New-kernel saves must add a
// 'core' variant with its own strict schema instead of reusing this one.
export const activeGameSchema = z.object({
  schemaVersion: z.literal(CURRENT_SAVE_SCHEMA_VERSION),
  contentVersion: z.literal(CURRENT_CONTENT_VERSION),
  runFormat: z.literal('legacy'),
  run: legacyStateSchema,
  commandLog: z.array(historyEntrySchema)
});

export type ActiveGameSave = z.infer<typeof activeGameSchema>;

export type SaveMigrationResult =
  | { ok: true; save: ActiveGameSave; migratedFrom: number | null }
  | { ok: false; reason: 'save.invalid' | 'save.unsupported-version' | 'save.content-mismatch' };

export function migrateActiveGame(input: unknown): SaveMigrationResult {
  const current = activeGameSchema.safeParse(input);
  if (current.success) return { ok: true, save: current.data, migratedFrom: null };

  const legacy = legacyActiveGameSchema.safeParse(input);
  if (legacy.success) {
    return {
      ok: true,
      save: {
        schemaVersion: CURRENT_SAVE_SCHEMA_VERSION,
        contentVersion: CURRENT_CONTENT_VERSION,
        runFormat: 'legacy',
        run: legacy.data.state,
        commandLog: legacy.data.history
      },
      migratedFrom: 1
    };
  }

  if (typeof input === 'object' && input !== null) {
    const record = input as Record<string, unknown>;
    if ('schemaVersion' in record) {
      if (record.schemaVersion !== CURRENT_SAVE_SCHEMA_VERSION) {
        return { ok: false, reason: 'save.unsupported-version' };
      }
      if (record.contentVersion !== CURRENT_CONTENT_VERSION) {
        return { ok: false, reason: 'save.content-mismatch' };
      }
      return { ok: false, reason: 'save.invalid' };
    }
    if ('v' in record) {
      // v1 is a supported version; a failing v1 payload is corrupted data.
      return { ok: false, reason: record.v === 1 ? 'save.invalid' : 'save.unsupported-version' };
    }
  }
  return { ok: false, reason: 'save.invalid' };
}

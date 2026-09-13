import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { migrateActiveGame, type ActiveGameSave } from '../../src/infrastructure/persistence/save-schema';
import {
  ACTIVE_GAME_SAVE_KEY,
  ActiveGameRepository,
  LEGACY_SAVE_BACKUP_KEY
} from '../../src/infrastructure/persistence/active-game-repository';

const fixture = JSON.parse(readFileSync(resolve('test/fixtures/legacy-active-game-v1.json'), 'utf8'));

function memoryStorage(initial?: Record<string, string>) {
  const values = new Map<string, string>(Object.entries(initial ?? {}));
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key)
  };
}

function migratedSave(): ActiveGameSave {
  const result = migrateActiveGame(fixture);
  if (!result.ok) throw new Error('fixture must migrate');
  return result.save;
}

describe('active game save migration', () => {
  it('migrates a representative cr_active_game v1 snapshot to schema v2', () => {
    const result = migrateActiveGame(fixture);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.migratedFrom).toBe(1);
    expect(result.save).toMatchObject({ schemaVersion: 2, contentVersion: 1, runFormat: 'legacy' });
    expect(result.save.run).toMatchObject({ difficulty: 'medium', faction: 'guild', phase: 'settlement' });
    expect(result.save.commandLog).toHaveLength(3);
  });

  it('round-trips a v2 save without re-migrating', () => {
    const save = migratedSave();
    const result = migrateActiveGame(JSON.parse(JSON.stringify(save)));
    expect(result).toEqual({ ok: true, save, migratedFrom: null });
  });

  it('rejects malformed and unsupported saves with explicit reasons', () => {
    expect(migrateActiveGame({ broken: true })).toEqual({ ok: false, reason: 'save.invalid' });
    expect(migrateActiveGame({ v: 99 })).toEqual({ ok: false, reason: 'save.unsupported-version' });
    expect(migrateActiveGame({ schemaVersion: 99 })).toEqual({ ok: false, reason: 'save.unsupported-version' });
  });

  it('reports a recognized-but-corrupted v1 payload as invalid, not unsupported', () => {
    expect(migrateActiveGame({ v: 1, state: { broken: true }, history: [] }))
      .toEqual({ ok: false, reason: 'save.invalid' });
  });

  it('rejects a v2 save written for different content with save.content-mismatch', () => {
    const save = migratedSave();
    expect(migrateActiveGame({ ...save, contentVersion: 99 }))
      .toEqual({ ok: false, reason: 'save.content-mismatch' });
  });

  it('rejects v1 saves whose state fails the legacy validState shape checks', () => {
    const corruptHand = structuredClone(fixture);
    corruptHand.state.hand = [{ id: 1.5, uid: 1 }];
    expect(migrateActiveGame(corruptHand)).toEqual({ ok: false, reason: 'save.invalid' });

    const corruptEffects = structuredClone(fixture);
    corruptEffects.state.timedEffects = [{ cardId: 1, turnsLeft: 0 }];
    expect(migrateActiveGame(corruptEffects)).toEqual({ ok: false, reason: 'save.invalid' });
  });
});

describe('ActiveGameRepository', () => {
  it('keeps storage behind a repository boundary', () => {
    const storage = memoryStorage({ [ACTIVE_GAME_SAVE_KEY]: JSON.stringify(fixture) });
    const repository = new ActiveGameRepository(storage);
    expect(repository.load()).toMatchObject({ ok: true, migratedFrom: 1 });
    repository.clear();
    expect(storage.values.has(ACTIVE_GAME_SAVE_KEY)).toBe(false);
  });

  it('returns save.invalid for missing or unparseable saves', () => {
    expect(new ActiveGameRepository(memoryStorage()).load())
      .toEqual({ ok: false, reason: 'save.invalid' });
    expect(new ActiveGameRepository(memoryStorage({ [ACTIVE_GAME_SAVE_KEY]: '{oops' })).load())
      .toEqual({ ok: false, reason: 'save.invalid' });
  });

  it('refuses to overwrite a legacy v1 save without an explicit replaceLegacy flag', () => {
    const raw = JSON.stringify(fixture);
    const storage = memoryStorage({ [ACTIVE_GAME_SAVE_KEY]: raw });
    const repository = new ActiveGameRepository(storage);

    expect(repository.save(migratedSave())).toEqual({ ok: false, reason: 'save.legacy-present' });
    expect(storage.values.get(ACTIVE_GAME_SAVE_KEY)).toBe(raw);
    expect(storage.values.has(LEGACY_SAVE_BACKUP_KEY)).toBe(false);
  });

  it('backs up the original v1 payload before replacing it when replaceLegacy is set', () => {
    const raw = JSON.stringify(fixture);
    const storage = memoryStorage({ [ACTIVE_GAME_SAVE_KEY]: raw });
    const repository = new ActiveGameRepository(storage);

    expect(repository.save(migratedSave(), { replaceLegacy: true }))
      .toEqual({ ok: true, backedUp: true });
    expect(storage.values.get(LEGACY_SAVE_BACKUP_KEY)).toBe(raw);
    expect(repository.load()).toMatchObject({ ok: true, migratedFrom: null });
  });

  it('overwrites existing v2 or unusable content without a backup', () => {
    const storage = memoryStorage({ [ACTIVE_GAME_SAVE_KEY]: JSON.stringify(migratedSave()) });
    const repository = new ActiveGameRepository(storage);
    expect(repository.save(migratedSave())).toEqual({ ok: true, backedUp: false });

    const broken = memoryStorage({ [ACTIVE_GAME_SAVE_KEY]: '{oops' });
    expect(new ActiveGameRepository(broken).save(migratedSave())).toEqual({ ok: true, backedUp: false });
  });
});

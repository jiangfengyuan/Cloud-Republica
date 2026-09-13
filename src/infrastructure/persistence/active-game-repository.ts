import { migrateActiveGame, type ActiveGameSave, type SaveMigrationResult } from './save-schema';

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

export const ACTIVE_GAME_SAVE_KEY = 'cr_active_game';
export const LEGACY_SAVE_BACKUP_KEY = 'cr_active_game.v1.backup';

export type SaveWriteResult =
  | { ok: true; backedUp: boolean }
  | { ok: false; reason: 'save.legacy-present' };

export class ActiveGameRepository {
  constructor(private readonly storage: KeyValueStorage) {}

  load(): SaveMigrationResult {
    const raw = this.storage.getItem(ACTIVE_GAME_SAVE_KEY);
    if (!raw) return { ok: false, reason: 'save.invalid' };
    try {
      return migrateActiveGame(JSON.parse(raw));
    } catch {
      return { ok: false, reason: 'save.invalid' };
    }
  }

  // Never silently overwrite a legacy v1 save: the old UI cannot read v2 and
  // would treat the run as lost. Callers must pass replaceLegacy explicitly,
  // in which case the original payload is backed up first.
  save(save: ActiveGameSave, options?: { replaceLegacy?: boolean }): SaveWriteResult {
    const legacyRaw = this.readLegacyRaw();
    if (legacyRaw && !options?.replaceLegacy) return { ok: false, reason: 'save.legacy-present' };
    if (legacyRaw) this.storage.setItem(LEGACY_SAVE_BACKUP_KEY, legacyRaw);
    this.storage.setItem(ACTIVE_GAME_SAVE_KEY, JSON.stringify(save));
    return { ok: true, backedUp: legacyRaw !== null };
  }

  clear(): void {
    if (this.storage.removeItem) this.storage.removeItem(ACTIVE_GAME_SAVE_KEY);
    else this.storage.setItem(ACTIVE_GAME_SAVE_KEY, '');
  }

  private readLegacyRaw(): string | null {
    const raw = this.storage.getItem(ACTIVE_GAME_SAVE_KEY);
    if (!raw) return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed === 'object' && parsed !== null && (parsed as { v?: unknown }).v === 1) {
        return raw;
      }
    } catch {
      // Unparseable content is already unusable; overwriting it loses nothing.
    }
    return null;
  }
}

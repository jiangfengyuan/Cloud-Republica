# Contributing to Cloud Republic

Thanks for helping improve the game. Cloud Republic is in a controlled migration: the browser release is still driven by `index.html` and `js/`, while `src/` is the new TypeScript domain core being verified against it.

## Good first contributions

- Bug fixes with a reproduction or regression test.
- Accessibility, mobile-layout, localisation, and documentation improvements.
- Balance proposals backed by deterministic simulation results.
- Additions to the TypeScript core that preserve the tested legacy behaviour.

## Before opening a pull request

1. Keep a pull request focused on one concern.
2. Do not add external images, fonts, sounds, or other assets unless the source, licence, and attribution requirements are documented in the same pull request.
3. Preserve the offline `file://` experience unless the change explicitly updates the release model.
4. Run `npm run check`.

## Architecture boundary

- Make live gameplay changes in the legacy modules only when necessary for the current release.
- Keep `src/domain` independent of the DOM and browser storage.
- Update or add parity, migration, or end-to-end coverage whenever a rule, save format, or UI flow changes.

Please open an issue before proposing a large new system or a broad refactor, so the migration path can be agreed first.

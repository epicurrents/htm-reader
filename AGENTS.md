# @epicurrents/htm-reader — instructions and architecture notes for AI coding assistants

Read [README.md](README.md) first for the public surface and the reading contract. This file covers what a change here has to respect.

Read [edf-reader](../edf-reader)'s AGENTS.md for the reader pattern the family follows; this package is the smallest reader and the only one serving two formats.

## Toolchain

| Concern | This package |
|---|---|
| Build | Vite 7, ESM `dist/` with `preserveModules`, workers inlined |
| Workers | `src/workers/*.worker.ts`, one per format, also emitted standalone into `umd/` |
| Types | `epicurrents-build-types` |
| Lint | `eslint.config.mjs`, flat config, ESLint 9 |
| Tests | Vitest, jsdom, `npm test` type-checks the suite first |
| Aliases | `#document`, `#html`, `#markdown`, `#types`, `#util`, `#workers`, declared in both `tsconfig.json` and `vite.shared.mjs` |

**The alias lists must agree.** `tsconfig.json` maps `#*` to `src/*` wholesale, while `vite.shared.mjs` names each directory in a regular expression. A new directory under `src/` type-checks before it resolves, so adding one means adding it to that regular expression too — otherwise the editor is happy and the build cannot find the file.

## One contract, four callers

A worker and its substitute are two implementations of the same commission contract, and the substitutes exist precisely for deployments where the worker cannot run — so they are rarely exercised side by side. When each held its own copy of the message handling, they disagreed in three ways at once: the worker read the page number from `page` while the caller sends `pageNum`, it dropped `get-page` and `get-document` without replying, and it answered a validation failure twice. The substitute beside it was correct, so a multi-page Markdown document worked in main-thread mode and served page one in worker mode.

Both now delegate to [documentCommissions.ts](src/document/documentCommissions.ts), and a worker's whole body is [documentWorker.ts](src/document/documentWorker.ts). **Add a commission there, not in a worker or a substitute.** The parity test in [tests/worker.test.ts](tests/worker.test.ts) drives both with one script and compares the replies; it is the test that would have caught the original divergence.

## Every path replies exactly once

A commission that is never answered leaves the caller's promise pending forever, which a document module cannot distinguish from a page still loading. Three rules follow:

- A `catch` replies. Logging a failure and returning is how a worker hangs its caller.
- **`validateCommissionProps` is given the reply channel as its fourth argument.** Left to its default it posts to the global scope — which happens to be correct inside a worker and is the *window* inside a substitute, where the service never hears it. Passing it also means the validator's own reply is the only one, so a caller must not post a second failure after it returns false.
- An action this reader does not implement is a stated failure. The handler returns false for anything outside the contract and each caller settles it: a worker posts the failure itself, a substitute hands off to core's, which does the same.

## Reading a source never rejects

`_readSource` resolves to `null` on every failure — an unreadable file, a non-ok response, a transport error — and `getPageContent` turns that into empty content. This is not defensive habit: these run inside a worker's message handler, where a rejection posts no reply at all, which is the hang above. `FileReader` reports failure through an event rather than a throw, so the promise wrapping it has to reject and be caught on the spot.

## A format is chosen when the importer is constructed

`getFileTypeWorker()` takes no argument, so an importer cannot pick a worker per file — it hands over the worker for the format it was built with. Two things follow, and the second was a live defect:

- A setup offering both formats registers two importers.
- **An importer advertises only its own format's file types.** Advertising both let a Markdown importer accept `.html`, and the study then declared `format: 'html'` while the worker was the Markdown one, so the HTML arrived escaped into visible text. `FILE_TYPES` in [HtmImporter.ts](src/HtmImporter.ts) is keyed by format for that reason.

A document module refuses to build a resource without a worker, so a format that returned `null` here could be imported and never opened. Both formats have one.

## Keep the core barrel out of the workers

A worker is inlined into `dist/` as a source string, so its bytes are paid by every consumer whether or not the worker ever runs. `import { SETTINGS } from '@epicurrents/core'` costs 472 kB in a worker bundle; `@epicurrents/core/config` costs 14 kB for the same symbol, and `@epicurrents/core/util` 43 kB. Core declares no `sideEffects`, so a bundler cannot drop a module merely because nothing uses its exports, and the barrel re-exports every subtree.

Neither worker here imports the barrel, and neither needs to: **no document processor reads an application setting.** `update-settings` is acknowledged rather than applied, because holding a settings copy is what would drag core in. A processor that comes to need a setting takes it from the snapshot the message carries.

## Sanitizing belongs to the consumer, asymmetrically

See the README section. The rule for a change here: **never add sanitizing to a processor**, and never rely on Markdown's escaping as though it were a property of this package. Markdown gets it from markdown-it's default; HTML has nothing equivalent, and its processor returning its input unchanged is deliberate and tested.

## Tests

There are no doubles for core. The suite constructs real core classes, and the one place it mocks is the importer's two inlined worker bundles, which cannot be constructed in jsdom.

Two properties of this package make that easy, and are worth preserving:

- **A substitute needs no application runtime.** Reading settings off `window.__EPICURRENTS__` was the only thing that required it, and there are no settings to read. A test constructs one with no global installed.
- **A processor takes no constructor arguments.**

`vi.mock` is hoisted above the file's own declarations, so its factory has to be inline rather than a named const.

# @epicurrents/htm-reader

Reads text documents — Markdown and HTML — into the page-addressed form [@epicurrents/doc-module](https://github.com/epicurrents/doc-module) displays. One importer and one worker serve each format.

## Public surface

| Export | What it is |
|---|---|
| `HtmImporter` | Study importer. Constructed for one format, it advertises that format's file types and hands over its worker. |
| `MarkdownWorkerSubstitute` / `HtmlWorkerSubstitute` | Main-thread stand-ins for the workers, for a deployment that cannot run one. |
| `MarkdownProcessor` / `HtmlProcessor` | The format processors, for a caller reading a document without a worker or a service. |
| `DocumentProcessor` / `DocumentWorkerSubstitute` | The shared bases, for a third format. |
| `HtmDocumentFormat`, `HtmSourceFileContext`, `ConfigReadFile`, `DocumentFileImporter` | Types. |

## Reading a document

A document module commissions three things, and this reader answers them the same whether the work runs in a worker or in a substitute:

| Commission | Reply |
|---|---|
| `set-sources` | `numPages`, counted from the sources that were set |
| `get-page-content` | `content`, the requested page rendered as HTML |
| `update-settings` | acknowledged; reading a document depends on no application setting |

`get-page` and `get-document` are not implemented. They are answered with a failure rather than left unanswered, because a commission that is never settled leaves the caller's promise pending, which reads as a document still loading.

### Pages

A page is addressed by the `pageNum` the document module sends, and looked up against each source's own `page` property rather than its position in the array. The two are usually the same — the module numbers its sources from one — but nothing requires it, so a reader that indexed by position would serve the wrong page for any other numbering.

An unresolvable page is empty content and a logged error, not a failed commission: a document that is short a page is still a document.

## Sanitizing is the consumer's job

**A processor returns markup as it read it, and a consumer inserting it into the DOM must sanitize it there.** The reader runs in a worker, which has no DOM and therefore no sanitizer worth trusting, and a reader that quietly removed part of a document would be the wrong place to discover it.

The two formats are not equally exposed, which is the part worth knowing:

- **Markdown** is rendered with raw HTML disabled, which is markdown-it's default, so an HTML fragment in the source is escaped into visible text. This renderer cannot emit markup its source did not describe as Markdown.
- **HTML** is returned byte for byte. Everything the file contains reaches the consumer, scripts included.

So a consumer that sanitizes gets the same safety for both, and a consumer that skips it is fine on Markdown and exposed on HTML. [@epicurrents/interface](https://github.com/epicurrents/interface) sanitizes with DOMPurify immediately before inserting, which is the right place for it.

## Workers carry no core

Neither worker imports the `@epicurrents/core` barrel. A worker is inlined into `dist/` as a source string, so its weight is paid by every consumer whether or not it ever runs, and importing one symbol from the barrel pulls in around 460 kB: core declares no `sideEffects`, so a bundler must keep every module the barrel re-exports. The two bundles come to 227 kB together, where reaching for core's settings singleton to hold a value no processor reads would have made them 1.1 MB.

A worker needing something from core takes it from a subpath — `@epicurrents/core/util` is 43 kB, `@epicurrents/core/config` 14 kB — rather than from the package root.

## Development

```bash
npm install
npm run build     # both worker bundles, then the library and its declarations
npm test          # type-checks the suite, then runs it
npm run lint
```

`build:workers` emits standalone bundles into `umd/` for a consumer whose content security policy cannot grant `worker-src blob:`; the default `dist/` inlines the same workers.

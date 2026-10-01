# @epicurrents/htm-reader — roadmap

Work left open by the first audit pass over this package, which repaired the commission contract, implemented the HTML format, put the package on the family toolchain and gave it its first tests. Items are roughly in order of how much they matter.

## Closed by this pass

Three findings recorded by the [doc-module](../doc-module) audit belonged here and are fixed:

- The Markdown worker read the page number from `page` while the document module sends `pageNum`, so a multi-page Markdown document served page one whichever page was asked for. The substitute beside it was already correct.
- The worker answered neither `get-page` nor `get-document`, leaving both commissions unsettled. Both are now stated failures, as is any other action the reader does not implement.
- The HTML format had no processor, so `getFileTypeWorker` returned `null` for it and a document module refused to build a resource — an imported `.html` file logged one error and produced nothing. Both formats now have a worker.

Two more were found here: the importer advertised both formats' file types regardless of the format it was constructed for, and the worker applied a settings snapshot with `Object.assign` over core's settings singleton, which drops the accessors declared on `app`.

## The page count a document module reports is still patched by its viewer

[doc-module](../doc-module)'s resource exposes a public setter for `numPages`, and the interface's HTM viewer sets it to 1 once content has loaded and the count is still zero. This reader reports a count from `set-sources` and always did, so the patch is working around something else — most likely the order in which the resource's setup and its first content load settle.

Closing it means finding out which, then removing the setter and the patch together. It belongs to doc-module and the interface; it is recorded here because this reader is the other half of the contract.

## The source type is duplicated and nothing checks that the copies agree

`HtmSourceFileContext` here and `DocumentSourceFile` in doc-module declare the same shape, and a reader declares no dependency on the modules that consume it, so nothing fails if they drift. A type-only dev dependency on doc-module would let a test assert assignability without coupling the two at runtime, at the cost of a reader repository depending on a module repository.

The alternative is core declaring the shape, which is where a contract shared by a reader and a module arguably belongs.

## A document reports no loading progress

The processors have no progress reporting, where the signal readers set an update callback that core's reader types declare. A page is read in one shot, so there are no intermediate states to report — but a large document fetched over a slow link has exactly one state worth reporting, and this reader cannot.

The dead `setUpdateCallback` that promised it and was wired to nothing was removed rather than left as a no-op. Adding it back means wiring it.

## Multi-page HTML is untested against a real document module

The reader serves any number of pages and the tests drive several, but every test here talks to a processor or a commission handler directly. Nothing exercises this package against doc-module's service, which is where the `pageNum` mismatch lived while both packages' suites were green.

A test driving doc-module against `MarkdownWorkerSubstitute` would close it, and belongs to whichever package owns the pairing. [doc-module](../doc-module)'s roadmap records the same gap from its side.

## `page` in the source type is an ordinal, and a named page would want its own property

The contract addresses a page by a 1-based ordinal, which is what paginated display needs: a count, a current page, and next and previous. A format with named divisions rather than pages — a reflowable one, where a spine item is addressed by an identifier — wants an identifier **alongside** the ordinal rather than widening it, because the count and the navigation still need the ordinal.

Widening `pageNum` to accept a string would also not validate: core's `validateCommissionProps` matches a single constructor name and has no union spelling. The decision belongs to doc-module, which owns the contract; its roadmap carries it.

## A fetched source has no timeout, so a hung request never settles

`_readSource` resolves to empty content on a refused connection, an error status and a transport failure, but a request that is accepted and then answers nothing hangs the `fetch` promise, and with it the commission — the same unsettled-caller failure the rest of this pass closed, one layer further down.

An `AbortSignal.timeout` closes it, and the reason it is recorded rather than done is that the duration is a policy choice: a document fetched over a slow link is a legitimate slow response, and cutting it off turns a working deployment into a broken one. It belongs with whatever else the family decides about network deadlines, rather than being invented here.

## Blob URLs are created per imported file and never revoked

`importFile` creates one for every file and nothing revokes it, so the whole file stays reachable for the session. This is the house pattern rather than a defect here — core does the same in eight places, `GenericStudyImporter` included — and the fix is a lifetime owner for the URL, which is core's to decide. Recorded in the builder's roadmap.

## Smaller things

`DocumentFileImporter` adds nothing to core's `FileFormatImporter` and carries an eslint exemption to say so. It is a named seam, kept so the packages building on it name this reader's contract; a second document reader would tell us whether it should hold anything.

The `exports` map declares `./types` and `./dist/types` for the same file, and `./workers/*` and `./umd/*` for the same directory. Narrowing it is a breaking change for a consumer using the redundant spelling, so it waits for a version that can carry one.

`set-sources` validates its argument as an array while `setSources` accepts one source or many. The commission names the shape the validator can actually check; the permissive setter is the processor's own API.

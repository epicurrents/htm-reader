/**
 * Tests for the study importer: the file types each format advertises, the worker it hands over and
 * the study files it produces.
 * @package    epicurrents/htm-reader
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import { beforeEach, describe, expect, test, vi } from 'vitest'

// The importer statically imports both inlined worker bundles, and a worker cannot be constructed in
// this environment. The default path is asserted through these stand-ins; the override path below
// needs none of it.
vi.mock('#workers/html.worker.ts?worker&inline', () => ({ default: class { } }))
vi.mock('#workers/markdown.worker.ts?worker&inline', () => ({ default: class { } }))
vi.mock('scoped-event-log', () => {
    const Log = {
        debug: vi.fn(), error: vi.fn(), info: vi.fn(), registerWorker: vi.fn(), warn: vi.fn(),
    }
    return { Log, default: Log }
})

const { default: HtmImporter } = await import('../src/HtmImporter')

/** Every extension an importer advertises, flattened out of its accept maps. */
const extensions = (importer: InstanceType<typeof HtmImporter>) => {
    return importer.fileTypes.flatMap(type => Object.values(type.accept).flat())
}

beforeEach(() => {
    vi.clearAllMocks()
})

describe('advertised file types', () => {
    test('a markdown importer advertises only the markdown extensions', () => {
        // Advertising an extension this importer cannot read produces a study whose declared format
        // and whose worker disagree, which shows up as HTML source rendered as visible text.
        expect(extensions(new HtmImporter('markdown')).sort()).toEqual(['.markdown', '.md'])
    })

    test('an html importer advertises only the html extensions', () => {
        expect(extensions(new HtmImporter('html')).sort()).toEqual(['.htm', '.html'])
    })
})

describe('the worker handed to a document module', () => {
    test.each(['html', 'markdown'] as const)('%s has a worker', (format) => {
        // A document module refuses to build a resource without one, so a format returning none here
        // could be imported and never opened.
        expect(new HtmImporter(format).getFileTypeWorker()).not.toBeNull()
    })

    test.each(['html', 'markdown'] as const)('an override for %s takes precedence', (format) => {
        const override = { overridden: true } as unknown as Worker
        const importer = new HtmImporter(format)
        importer.setWorkerOverride(format, () => override)
        expect(importer.getFileTypeWorker()).toBe(override)
    })

    test('an override registered for the other format is not used', () => {
        const importer = new HtmImporter('markdown')
        importer.setWorkerOverride('html', () => ({ wrong: true }) as unknown as Worker)
        expect(importer.getFileTypeWorker()).not.toMatchObject({ wrong: true })
    })
})

describe('importing a file', () => {
    test('a study file records the format read from the extension', async () => {
        const importer = new HtmImporter('markdown')
        const file = new File(['# hello'], 'notes.md', { type: 'text/markdown' })
        const studyFile = await importer.importFile(file)
        expect(studyFile).toMatchObject({ format: 'markdown', modality: 'htm', name: 'notes.md', role: 'data' })
        expect(studyFile.file).toBe(file)
    })

    test('an unrecognized extension falls back to the importer own format', async () => {
        // Rather than to an empty string, which reaches the resource as its document format.
        const studyFile = await new HtmImporter('html').importFile(new File(['<p>hi</p>'], 'page.txt'))
        expect(studyFile.format).toBe('html')
    })

    test('a configured format overrides the extension', async () => {
        const studyFile = await new HtmImporter('markdown')
            .importFile(new File(['<p>hi</p>'], 'page.md'), { format: 'html' })
        expect(studyFile.format).toBe('html')
    })

    test('an imported url needs no file', async () => {
        const studyFile = await new HtmImporter('html').importUrl('https://example.test/doc.html')
        expect(studyFile).toMatchObject({ file: null, format: 'html', url: 'https://example.test/doc.html' })
        expect(studyFile.name).toBe('doc.html')
    })

    test('imported files accumulate in the study', async () => {
        const importer = new HtmImporter('markdown')
        await importer.importFile(new File(['a'], 'one.md'))
        await importer.importFile(new File(['b'], 'two.md'))
        expect(importer.study?.files).toHaveLength(2)
    })
})

describe('format detection across the extensions', () => {
    test.each([
        ['page.htm', 'html'],
        ['page.html', 'html'],
        ['notes.md', 'markdown'],
        ['notes.markdown', 'markdown'],
    ])('%s is read as %s', async (name, format) => {
        expect((await new HtmImporter('html').importFile(new File(['x'], name))).format).toBe(format)
    })

    test('a url with no recognizable name still produces a study file', async () => {
        const studyFile = await new HtmImporter('markdown').importUrl('https://example.test/')
        expect(studyFile.format).toBe('markdown')
        expect(studyFile.url).toBe('https://example.test/')
    })

    test('a configured name and mime type override what the source carries', async () => {
        const studyFile = await new HtmImporter('markdown').importFile(
            new File(['x'], 'original.md', { type: 'text/markdown' }),
            { mime: 'text/plain', name: 'renamed.md' }
        )
        expect(studyFile).toMatchObject({ mime: 'text/plain', name: 'renamed.md' })
    })

    test('an imported url takes its name from the configuration when given', async () => {
        const studyFile = await new HtmImporter('html').importUrl(
            'https://example.test/a/b/c.html', { name: 'titled.html' }
        )
        expect(studyFile.name).toBe('titled.html')
    })
})

describe('a format outside the two', () => {
    test('is read as markdown rather than crashing the file matching later', () => {
        // An unknown format would otherwise put an undefined entry in the file types, and surface as
        // a type error inside core's file-name matching.
        const importer = new HtmImporter('epub' as unknown as 'markdown')
        expect(extensions(importer).sort()).toEqual(['.markdown', '.md'])
        expect(importer.getFileTypeWorker()).not.toBeNull()
    })
})

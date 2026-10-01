/**
 * Tests for the shared document processor: the page lookup and reading a source.
 * @package    epicurrents/htm-reader
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import { afterEach, describe, expect, test, vi } from 'vitest'
import HtmlProcessor from '../src/html/HtmlProcessor'
import { emptySource, fileSource, urlSource } from './sources'

// The HTML processor renders by returning its source unchanged, so a content assertion here reads the
// base class's behaviour rather than a markup transformation on top of it.
const processor = () => new HtmlProcessor()

describe('page sources', () => {
    test('numPages counts the sources that were set', () => {
        const proc = processor()
        expect(proc.numPages).toBe(0)
        proc.setSources([fileSource(1, 'a'), fileSource(2, 'b')])
        expect(proc.numPages).toBe(2)
    })

    test('a lone source is normalized into an array of one', () => {
        const proc = processor()
        proc.setSources(fileSource(1, 'a'))
        expect(proc.numPages).toBe(1)
        expect(proc.sources).toHaveLength(1)
    })

    test('setting sources replaces the previous set rather than appending to it', () => {
        const proc = processor()
        proc.setSources([fileSource(1, 'a'), fileSource(2, 'b')])
        proc.setSources([fileSource(1, 'c')])
        expect(proc.numPages).toBe(1)
    })
})

describe('page lookup', () => {
    test('a page is found by its page number, not by its position', async () => {
        // The lookup reads the `page` property. A sources array whose numbering does not start at one
        // is what distinguishes the two, and returning position 0 for page 7 is the failure.
        const proc = processor()
        proc.setSources([fileSource(7, 'seven'), fileSource(8, 'eight')])
        expect(await proc.getPageContent(8)).toBe('eight')
        expect(await proc.getPageContent(7)).toBe('seven')
    })

    test('every page of a multi-page document is reachable', async () => {
        const proc = processor()
        proc.setSources([1, 2, 3, 4].map(page => fileSource(page, `content ${page}`)))
        for (const page of [1, 2, 3, 4]) {
            expect(await proc.getPageContent(page)).toBe(`content ${page}`)
        }
    })

    test('an omitted page number returns the first page', async () => {
        const proc = processor()
        proc.setSources([fileSource(1, 'first'), fileSource(2, 'second')])
        expect(await proc.getPageContent()).toBe('first')
        expect(await proc.getPageContent(undefined)).toBe('first')
    })

    test('a page number that matches no source returns empty content', async () => {
        const proc = processor()
        proc.setSources([fileSource(1, 'first')])
        expect(await proc.getPageContent(2)).toBe('')
    })

    test('a duplicated page number returns the first match', async () => {
        const proc = processor()
        proc.setSources([fileSource(1, 'first'), fileSource(1, 'shadowed')])
        expect(await proc.getPageContent(1)).toBe('first')
    })

    test('content requested before any source is set returns empty content', async () => {
        expect(await processor().getPageContent()).toBe('')
        expect(await processor().getPageContent(1)).toBe('')
    })
})

describe('reading a source', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    test('a file source is read as text', async () => {
        const proc = processor()
        proc.setSources(fileSource(1, '<p>from a file</p>'))
        expect(await proc.getPageContent(1)).toBe('<p>from a file</p>')
    })

    test('a url source is fetched', async () => {
        const fetchMock = vi.fn().mockResolvedValue(
            { ok: true, status: 200, text: () => Promise.resolve('<p>fetched</p>') }
        )
        vi.stubGlobal('fetch', fetchMock)
        const proc = processor()
        proc.setSources(urlSource(1, 'https://example.test/page.html'))
        expect(await proc.getPageContent(1)).toBe('<p>fetched</p>')
        expect(fetchMock).toHaveBeenCalledWith('https://example.test/page.html')
    })

    test('a file takes precedence over a url on the same source', async () => {
        const fetchMock = vi.fn()
        vi.stubGlobal('fetch', fetchMock)
        const proc = processor()
        proc.setSources({ ...fileSource(1, 'from the file'), url: 'https://example.test/page.html' })
        expect(await proc.getPageContent(1)).toBe('from the file')
        expect(fetchMock).not.toHaveBeenCalled()
    })

    test('an error response resolves to empty content instead of rejecting', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, text: () => Promise.resolve('') }))
        const proc = processor()
        proc.setSources(urlSource(1, 'https://example.test/missing.html'))
        await expect(proc.getPageContent(1)).resolves.toBe('')
    })

    test('a transport failure resolves to empty content instead of rejecting', async () => {
        // A rejection here would leave a worker posting no reply at all, so the caller's commission
        // would never settle. Empty content is the settled outcome.
        vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')))
        const proc = processor()
        proc.setSources(urlSource(1, 'https://example.test/page.html'))
        await expect(proc.getPageContent(1)).resolves.toBe('')
    })

    test('a source carrying neither a file nor a url returns empty content', async () => {
        const proc = processor()
        proc.setSources(emptySource(1))
        await expect(proc.getPageContent(1)).resolves.toBe('')
    })
})

describe('a source that cannot be read', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    test('a failing file read resolves to empty content instead of rejecting', async () => {
        // FileReader reports failure through an event rather than a throw, so the promise wrapping it
        // has to reject and be caught; leaving it unhandled posts no reply out of a worker at all.
        class FailingFileReader {
            error = new DOMException('unreadable', 'NotReadableError')
            onerror: (() => void) | null = null
            onload: (() => void) | null = null
            result = null
            readAsText () {
                setTimeout(() => this.onerror?.(), 0)
            }
        }
        vi.stubGlobal('FileReader', FailingFileReader)
        const proc = processor()
        proc.setSources(fileSource(1, 'never read'))
        await expect(proc.getPageContent(1)).resolves.toBe('')
    })

    test('a file read yielding nothing resolves to empty content', async () => {
        class EmptyFileReader {
            onerror: (() => void) | null = null
            onload: (() => void) | null = null
            result: string | null = null
            readAsText () {
                setTimeout(() => this.onload?.(), 0)
            }
        }
        vi.stubGlobal('FileReader', EmptyFileReader)
        const proc = processor()
        proc.setSources(fileSource(1, 'ignored'))
        await expect(proc.getPageContent(1)).resolves.toBe('')
    })
})

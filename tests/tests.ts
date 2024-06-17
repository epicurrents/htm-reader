/**
 * Epicurrents HTM file reader tests.
 * Due to the high level of integration, tests must be run sequentially.
 * This file describes the testing sequence and runs the appropriate tests.
 * @package    epicurrents/htm-reader
 * @copyright  2024 Sampsa Lohi
 * @license    Apache-2.0
 */

import HtmReader from '../src/HtmReader'

describe('Epicurrents HTM file reader tests', () => {
    test('Create and instance of file loader', () => {
        const loader = new HtmReader()
        expect(loader).toBeDefined()
    })
})

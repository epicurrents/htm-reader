/**
 * Epicurrents HTML document worker.
 * @package    epicurrents/htm-reader
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

import { documentWorkerHandler } from '#document/documentWorker'
import HtmlProcessor from '#html/HtmlProcessor'

const SCOPE = 'html.worker'

onmessage = documentWorkerHandler(new HtmlProcessor(), SCOPE)

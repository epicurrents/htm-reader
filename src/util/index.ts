/**
 * Epicurrents HTM reader utilities.
 * @package    epicurrents/htm-reader
 * @copyright  2026 Sampsa Lohi
 * @license    Apache-2.0
 */

/**
 * Coerce a caught value into an `Error`, which is what the logger's cause parameter takes. A `catch`
 * binding is `unknown`, and a thrown non-error would otherwise be reported as an empty cause.
 * @param reason - The caught value.
 * @returns The value itself if it is already an `Error`, a new one carrying its string form if not.
 */
export const asError = (reason: unknown) => {
    return reason instanceof Error ? reason : new Error(String(reason))
}

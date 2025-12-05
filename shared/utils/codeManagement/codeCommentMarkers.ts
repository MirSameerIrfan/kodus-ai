const KODY_CODE_REVIEW_COMPLETED_MARKER = '## Code Review Completed! 🔥';
const KODY_CODE_REVIEW_COMPLETED_MARKER_ENCODED =
    '## Code Review Completed! ud83dudd25'; // Azure encoded emoji
const KODY_CRITICAL_ISSUE_COMMENT_MARKER = '# Found critical issues please';
const KODY_START_COMMAND_MARKER = '@kody start';

export {
    KODY_CODE_REVIEW_COMPLETED_MARKER,
    KODY_CRITICAL_ISSUE_COMMENT_MARKER,
    KODY_START_COMMAND_MARKER,
};

const EXACT_MARKERS = [
    KODY_CODE_REVIEW_COMPLETED_MARKER,
    KODY_CODE_REVIEW_COMPLETED_MARKER_ENCODED,
    KODY_CRITICAL_ISSUE_COMMENT_MARKER,
] as const;

/**
 * Pattern-based markers to exclude (supports variations)
 * Each pattern can match multiple variations of the same command
 */
const PATTERN_MARKERS = [/@?kody\s+start(-review)?|start-review/i] as const;

/**
 * Check if a comment contains any Kody marker (exact match or pattern)
 */
export const hasKodyMarker = (text: string | undefined | null): boolean => {
    if (!text) return false;

    const hasExactMatch = EXACT_MARKERS.some((marker) => text.includes(marker));
    if (hasExactMatch) return true;

    const hasPatternMatch = PATTERN_MARKERS.some((pattern) =>
        pattern.test(text),
    );

    return hasPatternMatch;
};

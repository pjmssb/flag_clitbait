// content.js

// --- Configuration for Clickbait Detection ---
const CLICKBAIT_PATTERNS = {
    // Keywords and phrases often used in clickbait headlines
    SUPERLATIVES_INTENSIFIERS: [
        "you won't believe", "shocking", "incredible", "amazing", "unbelievable",
        "secret", "revealed", "the best", "the worst", "epic", "mind-blowing",
        "this is why", "what happens next", "never guess", "actually", "literally",
        "guaranteed", "proven", "finally", "exposed", "viral", "hack", "must see",
        "don't miss", "game changer"
    ],
    // Rules for excessive or leading punctuation
    PUNCTUATION_CHECKS: {
        MIN_QUESTION_MARKS: 2,     // e.g., "Really???"
        MIN_EXCLAMATION_MARKS: 2,  // e.g., "Wow!!"
        ENDS_WITH_QUESTION_MARK_POTENTIALLY_CLICKBAIT: true, // e.g., "Is this the future?" (but not if it's a genuine question)
        MULTIPLE_MIXED_END_PUNCTUATION: /\?{2,}|!{2,}|\?!{1,}|\!\?{1,}/, // e.g. "!!", "??", "?!", "!?"
    },
    // Phrases or patterns that create an "information gap"
    INFORMATION_GAP: [
        "...", // Ellipses often create an info gap
        "this one trick", "this simple reason", "the truth about",
        "number \\d+ will shock you", // Regex for "Number X will shock you"
        "top \\d+ reasons",           // Regex for "Top X reasons"
        "things you didn't know"
    ],
    // Heuristic for detecting excessive capitalization
    ALL_CAPS_THRESHOLD: 0.4, // If more than 40% of words (longer than 2 chars) are all caps
    MIN_WORDS_FOR_ALL_CAPS_CHECK: 3 // Minimum words in a title to check for all caps
};

// --- Helper Functions ---

/**
 * Checks if a significant portion of words in the text are in ALL CAPS.
 * @param {string} text The text to analyze.
 * @returns {boolean} True if potentially heavy on all caps, false otherwise.
 */
function isPotentiallyAllCapHeavy(text) {
    const words = text.trim().split(/\s+/);
    if (words.length < CLICKBAIT_PATTERNS.MIN_WORDS_FOR_ALL_CAPS_CHECK) return false;

    let upperCaseWords = 0;
    for (const word of words) {
        // Consider a word for all caps check if it's longer than 2 characters
        // and contains at least one letter.
        if (word.length > 2 && word === word.toUpperCase() && /[a-zA-Z]/.test(word)) {
            upperCaseWords++;
        }
    }
    return (upperCaseWords / words.length) > CLICKBAIT_PATTERNS.ALL_CAPS_THRESHOLD;
}

/**
 * Checks if the text contains any of the specified patterns (keywords/phrases or regex).
 * @param {string} text The text to check.
 * @param {string[]} patterns An array of string patterns (can be plain text or regex strings like "/pattern/i").
 * @returns {boolean} True if a pattern is found, false otherwise.
 */
function textContainsPattern(text, patterns) {
    const lowerText = text.toLowerCase();
    for (const pattern of patterns) {
        try {
            // Check if pattern is intended as a regex (e.g., "number \\d+ will shock you")
            // For this MVP, we'll treat patterns starting/ending with / as regex, otherwise plain string.
            // A more robust way would be to explicitly define regex patterns.
            if (pattern.includes('\\d') || pattern.includes('\\s') || pattern.startsWith('^') || pattern.endsWith('$')) { // Simple heuristic for regex-like strings
                const regex = new RegExp(pattern, "i"); // Case-insensitive match
                if (regex.test(text)) return true; // Test original text for regex to preserve case for some patterns if needed
            } else {
                if (lowerText.includes(pattern.toLowerCase())) return true;
            }
        } catch (e) {
            console.warn("ClickbaitWarner: Invalid pattern for regex:", pattern, e);
        }
    }
    return false;
}

/**
 * Checks for clickbait-style punctuation.
 * @param {string} text The text to analyze.
 * @returns {boolean} True if clickbait punctuation patterns are found, false otherwise.
 */
function checkPunctuation(text) {
    const qMarks = (text.match(/\?/g) || []).length;
    const eMarks = (text.match(/!/g) || []).length;

    if (qMarks >= CLICKBAIT_PATTERNS.PUNCTUATION_CHECKS.MIN_QUESTION_MARKS) return true;
    if (eMarks >= CLICKBAIT_PATTERNS.PUNCTUATION_CHECKS.MIN_EXCLAMATION_MARKS) return true;
    if (CLICKBAIT_PATTERNS.PUNCTUATION_CHECKS.MULTIPLE_MIXED_END_PUNCTUATION.test(text)) return true;

    // Check for single question mark at the end, but try to avoid flagging genuine questions.
    // This is tricky; for MVP, we'll be a bit lenient or flag it.
    if (CLICKBAIT_PATTERNS.PUNCTUATION_CHECKS.ENDS_WITH_QUESTION_MARK_POTENTIALLY_CLICKBAIT && text.endsWith("?")) {
        // Avoid flagging if it's a very short title that's likely a real question
        if (text.length > 15 && !text.endsWith("??")) return true;
    }
    return false;
}

/**
 * Determines if a given text string is likely clickbait based on defined patterns.
 * @param {string} text The text content to analyze.
 * @returns {boolean} True if the text is identified as potential clickbait, false otherwise.
 */
function isClickbait(text) {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return false;
    }

    const trimmedText = text.trim();

    if (textContainsPattern(trimmedText, CLICKBAIT_PATTERNS.SUPERLATIVES_INTENSIFIERS)) return true;
    if (checkPunctuation(trimmedText)) return true;
    if (textContainsPattern(trimmedText, CLICKBAIT_PATTERNS.INFORMATION_GAP)) return true;
    if (isPotentiallyAllCapHeavy(trimmedText)) return true;

    return false;
}

/**
 * Applies a visual flag to an element identified as potential clickbait.
 * @param {HTMLElement} element The DOM element to flag.
 */
function applyFlag(element) {
    // Check if already flagged to avoid duplicate flags
    if (element.dataset.clickbaitWarnerFlagged === "true") {
        return;
    }
    element.dataset.clickbaitWarnerFlagged = "true"; // Mark as flagged
    element.classList.add("potential-clickbait-flagged"); // Add CSS class for styling (e.g., border)

    // Create and prepend the text label
    const flagTextElement = document.createElement("span");
    flagTextElement.textContent = "[Potential Clickbait] "; // Added space for better separation
    flagTextElement.classList.add("clickbait-indicator-text"); // Add CSS class for styling the text

    // Prepend the flag to the element.
    // This might need adjustment based on specific site structures for optimal visibility.
    element.prepend(flagTextElement);
}

/**
 * Scans a given DOM node (and its children) for elements that might contain clickbait.
 * @param {Node} targetNode The DOM node to scan. Typically document.body or a newly added node.
 */
function scanForClickbait(targetNode) {
    // Selectors for common elements containing headlines, link text, or titles.
    // These will need to be adjusted and made more specific for different websites
    // for better accuracy and performance.
    const selectors = [
        'a h1', 'a h2', 'a h3', 'a h4', 'a h5', 'a h6', // Headlines within links
        'a span[id*="title"]', 'a div[id*="title"]',   // Spans/Divs with "title" in ID within links (e.g., YouTube)
        'a[title]',                                  // Links with a 'title' attribute
        'h1 a', 'h2 a', 'h3 a', 'h4 a',             // Links within headlines
        '[role="heading"] a',                       // ARIA headings with links
        // For YouTube specifically (can be refined with more specific selectors from manifest matches)
        'ytd-rich-grid-media #video-title',
        'ytd-video-renderer #video-title',
        'ytd-compact-video-renderer .metadata .title'
    ];

    // Find all relevant elements within the targetNode using the defined selectors
    targetNode.querySelectorAll(selectors.join(', ')).forEach(el => {
        let textToAnalyze = '';
        let elementToFlag = el;

        // Determine the text content and the element to flag (usually the link or its main content part)
        if (el.matches('a[title]')) {
            textToAnalyze = el.getAttribute('title');
            elementToFlag = el; // Flag the link itself
        } else {
            textToAnalyze = el.textContent;
            // Try to get the closest ancestor link if 'el' is a headline/span inside a link
            const closestLink = el.closest('a');
            if (closestLink) {
                elementToFlag = closestLink;
            } else {
                 elementToFlag = el; // If no parent link, flag the element itself (e.g. a heading)
            }
        }
        

        if (isClickbait(textToAnalyze)) {
            applyFlag(elementToFlag);
        }
    });

    // Additionally, check <a> tags directly for their text content if they don't contain typical headline tags
    // but might still be clickbaity (e.g., simple text links).
    targetNode.querySelectorAll('a').forEach(linkElement => {
        // Avoid re-processing if already flagged by the more specific selectors above
        if (linkElement.dataset.clickbaitWarnerFlagged === "true") return;

        // Prioritize title attribute if available and not empty
        const titleAttr = linkElement.getAttribute('title');
        let textToAnalyze = (titleAttr && titleAttr.trim().length > 0) ? titleAttr : linkElement.textContent;
        
        // Heuristic: Only check textContent if it's reasonably long and not just a URL.
        if (textToAnalyze && textToAnalyze.trim().length > 10 && !textToAnalyze.trim().startsWith('http')) {
            if (isClickbait(textToAnalyze)) {
                applyFlag(linkElement);
            }
        }
    });
    
    // Basic check for image alt text within links
    targetNode.querySelectorAll('a img[alt]').forEach(imgElement => {
        const parentLink = imgElement.closest('a');
        if (parentLink && parentLink.dataset.clickbaitWarnerFlagged === "true") return; // Link already flagged

        const altText = imgElement.getAttribute('alt');
        if (isClickbait(altText)) {
            applyFlag(parentLink || imgElement); // Flag the link, or image if no link (less common)
        }
    });
}

// --- DOM Observation for Dynamic Content ---

// Create a MutationObserver instance to watch for DOM changes
const observer = new MutationObserver((mutationsList) => {
    for (const mutation of mutationsList) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
            // When new nodes are added to the DOM (e.g., by infinite scroll, AJAX)
            mutation.addedNodes.forEach(newNode => {
                // We only care about element nodes, not text nodes, comments, etc.
                if (newNode.nodeType === Node.ELEMENT_NODE) {
                    // Scan the new node and its children for potential clickbait
                    scanForClickbait(newNode);
                }
            });
        }
        // For an MVP, we are not observing 'attributes' changes (e.g. if a title attribute changes dynamically).
        // This could be added if necessary:
        // else if (mutation.type === 'attributes' && mutation.attributeName === 'title') {
        //    scanForClickbait(mutation.target); // Rescan the element whose attribute changed
        // }
    }
});

// --- Initial Scan and Start Observing ---

/**
 * Performs an initial scan of the document body and starts the MutationObserver.
 */
function initialScanAndObserve() {
    console.log("Clickbait Warner MVP: Initializing scan...");
    // Perform an initial scan of the entire body for already loaded content
    scanForClickbait(document.body);

    // Start observing the document body for additions of new nodes (subtree for all descendants)
    observer.observe(document.body, {
        childList: true, // Observe direct children additions/removals
        subtree: true    // Observe all descendants for changes
    });
    console.log("Clickbait Warner MVP: Observer started.");
}

// Run the script.
// `document_idle` in manifest.json means the DOM is generally complete,
// but we still check readyState for robustness.
if (document.readyState === 'loading') {
    // If the document is still loading, wait for DOMContentLoaded
    document.addEventListener('DOMContentLoaded', initialScanAndObserve);
} else {
    // If the document has already loaded, run the initial scan and start observing immediately
    initialScanAndObserve();
}

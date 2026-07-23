"""
Heuristic spam/content filter for CyraCode names.
Proxies ML-based detection using entropy analysis, pattern matching, and a
word-block list.  Flagged names are stored but queued for human review rather
than outright rejected, so legitimate edge-cases are never permanently lost.
"""
import math
import re
from collections import Counter

# ---------------------------------------------------------------------------
# Block list — extend in production with a proper profanity library
# ---------------------------------------------------------------------------
_BLOCKED_WORDS: set[str] = {
    "spam", "test", "asdf", "qwerty", "abcdef", "xxxxxx",
    "aaaaaa", "admin", "null", "undefined", "root",
}

# Obvious auto-generated / gibberish patterns
_SPAM_PATTERNS: list[str] = [
    r"^(.)\1{4,}$",          # 5+ identical chars:  aaaaaaa
    r"^(..)\1{2,}$",         # repeating 2-char pair: ababab
    r"^\d+$",                 # pure digits
    r"^[^aeiou\s]{6,}$",     # 6+ consonants with no vowel (ASCII heuristic)
    r"^[!@#$%^&*()\-_=+]+$", # only punctuation
]


def _shannon_entropy(text: str) -> float:
    """Return Shannon entropy (bits) of the de-spaced, lower-cased string."""
    s = text.lower().replace(" ", "")
    if not s:
        return 0.0
    total = len(s)
    counts = Counter(s)
    return -sum((c / total) * math.log2(c / total) for c in counts.values())


def check_name(name: str) -> tuple[bool, str, bool, str]:
    """
    Evaluate a proposed CyraCode name.

    Returns
    -------
    (is_blocked, block_reason, should_flag, flag_reason)

    is_blocked  – True  → reject the registration immediately
    should_flag – True  → allow registration but store is_flagged=True for review
    """
    cleaned = name.strip()
    lower = cleaned.lower()
    no_space = lower.replace(" ", "")

    # ── Hard block: explicit bad words ──────────────────────────────────────
    for token in lower.split():
        if token in _BLOCKED_WORDS:
            return True, f"Name contains a blocked term: '{token}'", False, ""

    # ── Hard block: spam patterns ────────────────────────────────────────────
    for pattern in _SPAM_PATTERNS:
        if re.fullmatch(pattern, no_space, re.IGNORECASE):
            return True, "Name matches a known spam pattern.", False, ""

    # ── Hard block: entropy too low (very repetitive) ───────────────────────
    if len(no_space) >= 6:
        entropy = _shannon_entropy(no_space)
        if entropy < 1.2:
            return True, "Name is too repetitive or auto-generated.", False, ""

    # ── Soft flag: borderline entropy ────────────────────────────────────────
    if len(no_space) >= 6:
        entropy = _shannon_entropy(no_space)
        if 1.2 <= entropy < 2.0:
            return False, "", True, "Low character diversity — queued for review."

    # ── Soft flag: very long single token (no spaces) ───────────────────────
    if len(cleaned) > 35 and " " not in cleaned:
        return False, "", True, "Unusually long single word — queued for review."

    return False, "", False, ""

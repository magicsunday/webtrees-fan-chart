#!/usr/bin/env python3
"""Auto-resolve fuzzy PO entries that differ only in trivial punctuation.

Background:
    `msgmerge --previous` (invoked by `make lang-merge`) marks an entry as
    fuzzy whenever the English source msgid changes. Even a single em-dash
    swapped for a middle-dot triggers fuzzy, because msgmerge does a
    byte-level compare. `msgfmt` then drops every fuzzy entry from the
    compiled MO, so users see the English fallback for what should be a
    perfectly valid translation.

    This resolver walks every fuzzy entry, reads the previous msgid
    (`#| msgid "..."` stub that msgmerge --previous writes alongside the
    new one), classifies the diff against a fixed rule set, and when the
    rule set says the diff is purely punctuational (or a known German
    vocabulary refresh), rewrites the msgstr with the same swap applied
    and drops the fuzzy flag.

Rule set (trivial diffs the resolver auto-fixes):
    - ` — ` (em-dash with spaces)  ↔  ` · ` (middle-dot with spaces)
    - ` – ` (en-dash with spaces)  ↔  ` · ` (middle-dot with spaces)
    - ` — ` ↔ ` – ` (em ↔ en, both with spaces)
    - `,` ↔ `;` ↔ `.` swap when the diff is exactly that one character
    - whitespace-only diffs
    - DE-specific: "Dekade"/"Dekaden" ↔ "Jahrzehnt"/"Jahrzehnten" in the
      msgstr (the user prefers Jahrzehnt; the diff itself lives in the
      msgid, this rule keeps the msgstr in sync after the rename)

Anything else stays fuzzy and is listed at the end so a human can pick
it up.

@author  Rico Sonntag <mail@ricosonntag.de>
@license GPL-3.0-or-later
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

MODULE_ROOT = Path(__file__).resolve().parent.parent
LANG_DIR = MODULE_ROOT / "resources" / "lang"

# A PO string literal: a quoted run in which a backslash escapes the next
# character, so an escaped quote (\") does not prematurely end the literal.
# `_INNER` captures the still-escaped body for concatenation + unescaping.
_PO_LITERAL = r'"(?:[^"\\]|\\.)*"'
_PO_LITERAL_INNER = r'"((?:[^"\\]|\\.)*)"'

# Pairs that are accepted as equivalent — the resolver swaps one for the
# other in the msgstr to track the msgid change.
PUNCT_PAIRS: list[tuple[str, str]] = [
    (" — ", " · "),
    (" – ", " · "),
    (" — ", " – "),
    (" - ", " · "),
    (" - ", " — "),
    (" - ", " – "),
]

# DE-specific vocabulary refreshes that the resolver applies to a DE
# msgstr when the corresponding msgid change is detected.
DE_VOCAB_RULES: list[tuple[str, str]] = [
    ("Dekaden", "Jahrzehnten"),
    ("Dekade", "Jahrzehnt"),
]


def normalise_punctuation(text: str) -> str:
    """Collapse every trivial-punctuation variant to a single canonical
    form so two strings that differ only in dash/dot/spacing compare as
    equal under string equality."""
    out = text
    for a, b in PUNCT_PAIRS:
        out = out.replace(a, b)
    # Collapse runs of whitespace
    out = re.sub(r"\s+", " ", out).strip()
    return out


def msgid_diff_is_trivial(old: str, new: str) -> bool:
    """True when the only difference between old and new msgid falls
    under the trivial-punctuation rule set."""
    return normalise_punctuation(old) == normalise_punctuation(new)


def apply_punct_swap(msgstr: str, old_msgid: str, new_msgid: str) -> str:
    """For a trivial msgid swap (old → new), apply the same swap to
    the msgstr where the source-side pattern is present."""
    out = msgstr
    for a, b in PUNCT_PAIRS:
        if (a in old_msgid) and (b in new_msgid) and (a in out):
            out = out.replace(a, b)
        elif (b in old_msgid) and (a in new_msgid) and (b in out):
            out = out.replace(b, a)
    return out


def apply_de_vocab(msgstr: str) -> str:
    """Apply DE vocabulary refresh rules. Safe to call on any locale's
    msgstr — the rules only match DE forms."""
    out = msgstr
    for src, dst in DE_VOCAB_RULES:
        out = out.replace(src, dst)
    return out


def parse_po_blocks(text: str) -> list[str]:
    """Split PO text into blank-line-separated blocks while preserving
    the trailing newline structure for round-trip writing."""
    return re.split(r"(\n\s*\n)", text)


def block_is_fuzzy(block: str) -> bool:
    return bool(re.search(r"^#, .*\bfuzzy\b", block, flags=re.MULTILINE))


def extract_string_literal(block: str, prefix: str) -> str | None:
    """Extract the concatenated string value for a `prefix "..." "..."`
    multi-line literal (e.g. `msgid`, `msgstr`, `#| msgid`)."""
    if prefix.startswith("#|"):
        # Previous-msgid stubs use the `#| msgid` / `#| msgstr` form;
        # match the prefix at the start of each comment line.
        pat = (
            r"^"
            + re.escape(prefix)
            + r"\s+((?:" + _PO_LITERAL + r"\s*)+(?:\n#\|\s*" + _PO_LITERAL + r"\s*)*)"
        )
        m = re.search(pat, block, flags=re.MULTILINE)
        if not m:
            return None
        raw = m.group(1)
        # Pull every "..." literal regardless of intervening "#|" markers
        chunks = re.findall(_PO_LITERAL_INNER, raw)
        return unescape_po_string("".join(chunks))
    pat = r"^" + re.escape(prefix) + r"\s+((?:" + _PO_LITERAL + r"\s*)+)"
    m = re.search(pat, block, flags=re.MULTILINE)
    if not m:
        return None
    chunks = re.findall(_PO_LITERAL_INNER, m.group(1))
    return unescape_po_string("".join(chunks))


def unescape_po_string(text: str) -> str:
    """Decode PO backslash escapes (\\\\, \\", \\n, \\t, \\r) to their
    literal characters. Inverse of encode_po_string, so extract → encode
    round-trips a value that contains quotes, backslashes or control
    characters instead of truncating or double-escaping it."""
    mapping = {"\\": "\\", "\"": "\"", "n": "\n", "t": "\t", "r": "\r"}
    out: list[str] = []
    i = 0
    length = len(text)
    while i < length:
        ch = text[i]
        if (ch == "\\") and ((i + 1) < length):
            out.append(mapping.get(text[i + 1], text[i + 1]))
            i += 2
        else:
            out.append(ch)
            i += 1
    return "".join(out)


def encode_po_string(text: str) -> str:
    """Encode a string as a PO multi-line literal. Short strings get
    a single-line form; longer ones get the canonical empty-first-line
    + wrapped continuation lines."""
    escaped = (
        text.replace("\\", "\\\\")
        .replace("\"", "\\\"")
        .replace("\n", "\\n")
        .replace("\t", "\\t")
        .replace("\r", "\\r")
    )
    if len(escaped) < 70:
        return f'"{escaped}"'
    lines = ['""']
    remaining = escaped
    while remaining:
        chunk = remaining[:76]
        if len(remaining) > 76:
            cut = chunk.rfind(" ")
            if cut > 40:
                chunk = remaining[: cut + 1]
                remaining = remaining[cut + 1 :]
            else:
                remaining = remaining[76:]
        else:
            remaining = ""
        lines.append(f'"{chunk}"')
    return "\n".join(lines)


def rewrite_block(block: str, new_msgstr: str) -> str:
    """Return the block with the fuzzy marker stripped, the `#| msgid`
    previous-stub stripped, and the msgstr replaced by `new_msgstr`."""
    out = block
    # Drop standalone fuzzy comment line
    out = re.sub(r"^#, fuzzy\s*\n", "", out, flags=re.MULTILINE)
    # Drop `fuzzy,` and `, fuzzy` from a mixed flag line
    out = re.sub(r"#,\s*fuzzy\s*,\s*", "#, ", out)
    out = re.sub(r"(#,[^\n]*?),\s*fuzzy(\s*)", r"\1\2", out)
    # Drop previous-msgid stubs
    out = re.sub(r"^#\|\s*msgid.*(?:\n#\|\s*\".*\")*\n", "", out, flags=re.MULTILINE)
    out = re.sub(r"^#\|\s*msgctxt.*\n", "", out, flags=re.MULTILINE)
    # Replace msgstr block. A function replacement avoids re.sub treating
    # backslashes in the encoded value (\n, \", \\) as group/escape refs.
    out = re.sub(
        r"msgstr\s+((?:" + _PO_LITERAL + r"\s*)+)",
        lambda _m: f"msgstr {encode_po_string(new_msgstr)}",
        out,
        count=1,
    )
    return out


def resolve_locale(po_path: Path) -> tuple[int, int, list[str]]:
    """Process one PO file. Returns (resolved_count, remaining_fuzzy,
    unresolved_msgids)."""
    text = po_path.read_text(encoding="utf-8")
    blocks = parse_po_blocks(text)

    resolved = 0
    remaining_fuzzy = 0
    unresolved: list[str] = []

    is_de = po_path.parent.name == "de"

    new_blocks: list[str] = []
    for block in blocks:
        if not block.strip() or not block_is_fuzzy(block):
            new_blocks.append(block)
            continue

        prev_msgid = extract_string_literal(block, "#| msgid")
        new_msgid = extract_string_literal(block, "msgid")
        msgstr = extract_string_literal(block, "msgstr")

        if new_msgid is None or msgstr is None or msgstr == "":
            # Nothing to migrate — leave as fuzzy for human review.
            remaining_fuzzy += 1
            unresolved.append(new_msgid[:60] if new_msgid else "(unknown)")
            new_blocks.append(block)
            continue

        if prev_msgid is None:
            # No --previous stub — fall back to "is the existing msgstr
            # already equivalent to the new msgid under the rule set?"
            # which only fires when msgstr was an English source (the
            # en-US case) that just needs the punctuation swap.
            if normalise_punctuation(msgstr) == normalise_punctuation(new_msgid):
                resolved += 1
                new_blocks.append(rewrite_block(block, new_msgid))
                continue
            remaining_fuzzy += 1
            unresolved.append(new_msgid[:60])
            new_blocks.append(block)
            continue

        if not msgid_diff_is_trivial(prev_msgid, new_msgid):
            remaining_fuzzy += 1
            unresolved.append(new_msgid[:60])
            new_blocks.append(block)
            continue

        # Trivial diff. Apply the same swap to the msgstr.
        migrated = apply_punct_swap(msgstr, prev_msgid, new_msgid)
        if is_de:
            migrated = apply_de_vocab(migrated)

        resolved += 1
        new_blocks.append(rewrite_block(block, migrated))

    po_path.write_text("".join(new_blocks), encoding="utf-8")
    return resolved, remaining_fuzzy, unresolved


def main() -> int:
    if not LANG_DIR.exists():
        print(f"  ✘ {LANG_DIR} not found", file=sys.stderr)
        return 1

    total_resolved = 0
    total_remaining = 0
    per_locale_unresolved: dict[str, list[str]] = {}

    for po in sorted(LANG_DIR.glob("*/messages.po")):
        resolved, remaining, unresolved = resolve_locale(po)
        total_resolved += resolved
        total_remaining += remaining
        if unresolved:
            per_locale_unresolved[po.parent.name] = unresolved
        if resolved or remaining:
            print(
                f"  {po.parent.name:8s}  resolved={resolved:3d}  "
                f"remaining-fuzzy={remaining:3d}"
            )

    if per_locale_unresolved:
        print()
        print("  Unresolved fuzzy entries (non-trivial diff — human review needed):")
        for loc, msgids in per_locale_unresolved.items():
            print(f"    {loc}:")
            for m in msgids[:10]:
                print(f"      - {m}")
            if len(msgids) > 10:
                print(f"      … and {len(msgids) - 10} more")

    print()
    print(f"  ✔ fuzzy-resolver: resolved={total_resolved}, remaining={total_remaining}")
    return 0


if __name__ == "__main__":
    sys.exit(main())

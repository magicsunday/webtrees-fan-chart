#!/usr/bin/env python3
"""Self-test for fuzzy-resolver.py escape handling.

Not wired into CI (these modules ship no Python test harness); run manually
with `python3 dev/test-fuzzy-resolver.py`. Guards the round-trip integrity of
PO string literals that contain escaped quotes, backslashes or control
characters — the case a naive `"[^"]*"` extractor truncates and corrupts.

@author  Rico Sonntag <mail@ricosonntag.de>
@license GPL-3.0-or-later
"""
from __future__ import annotations

import importlib.util
import re
import sys
from pathlib import Path

_spec = importlib.util.spec_from_file_location(
    "fuzzy_resolver", Path(__file__).resolve().parent / "fuzzy-resolver.py"
)
fr = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(fr)


def main() -> int:
    failures = 0

    def check(name: str, condition: bool) -> None:
        nonlocal failures
        print(f"  {'✔' if condition else '✘ FAIL'}  {name}")
        if not condition:
            failures += 1

    # encode → unescape round-trips a value with quotes, backslashes and
    # control characters instead of truncating or double-escaping it.
    samples = [
        'He said "hi"',
        "back\\slash",
        "line1\nline2",
        "tab\there",
        "plain — dash",
        'quote " and \\ and \n mixed',
    ]
    for sample in samples:
        encoded = fr.encode_po_string(sample)
        chunks = re.findall(fr._PO_LITERAL_INNER, encoded)
        decoded = fr.unescape_po_string("".join(chunks))
        check(f"round-trip {sample!r}", decoded == sample)

    # extract pulls a full msgstr that contains an escaped quote.
    block = 'msgid "old"\nmsgstr "She said \\"hello\\" loudly"\n'
    check(
        "extract escaped-quote msgstr",
        fr.extract_string_literal(block, "msgstr") == 'She said "hello" loudly',
    )

    # rewrite_block writes a value with quotes + newline without corruption
    # and drops the fuzzy flag.
    fuzzy_block = '#, fuzzy\nmsgid "x"\nmsgstr "old"\n'
    new_value = 'A "quoted" value\nwith newline'
    rewritten = fr.rewrite_block(fuzzy_block, new_value)
    check(
        "rewrite_block round-trips quotes + newline",
        fr.extract_string_literal(rewritten, "msgstr") == new_value,
    )
    check("rewrite_block drops the fuzzy flag", "fuzzy" not in rewritten)

    print(f"\n  {'ALL GREEN' if failures == 0 else f'{failures} FAILURE(S)'}")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())

"""
Splits extracted contract text back into numbered clauses.

PDF text extraction often loses original line breaks, so a clause like:
  "1.1 Confidential Information means..."
  "1.2 The Receiving Party agrees..."
ends up as one continuous run-on string. This module re-splits that text
using the numbering pattern (e.g. "1.1", "2.3", "10.4") so the rest of the
pipeline can work clause-by-clause instead of treating the whole contract
as a single blob.
"""
from __future__ import annotations

import re
from dataclasses import dataclass


# Matches clause numbers like "1.1", "2.3", "10.4" at a word boundary,
# followed by a space and then text. Also matches top-level section
# headers like "1. DEFINITION OF..." (no decimal).
_CLAUSE_PATTERN = re.compile(
    r"(?<![\d.])(?P<num>\d{1,2}\.\d{1,2})\.?\s+(?=[A-Z'])"
)

_SECTION_HEADER_PATTERN = re.compile(
    r"(?<![\d.])(?P<num>\d{1,2})\.\s+(?P<title>[A-Z][A-Z\s\-]{2,60}?)(?=\s+\d{1,2}\.\d{1,2}\s|\s+\d{1,2}\.\s|$)"
)


@dataclass
class Section:
    title: str
    clauses: list["Clause"]


@dataclass
class Clause:
    id: str
    text: str


def split_into_sections(text: str) -> list[Section]:
    """
    Splits raw contract text into sections (e.g. "1. DEFINITION OF...")
    each containing numbered sub-clauses (e.g. "1.1", "1.2").

    Falls back to a single section with the whole text as one clause
    if no numbering pattern is detected (e.g. unstructured contracts).
    """
    text = " ".join(text.split())  # normalise whitespace/newlines

    header_matches = list(_SECTION_HEADER_PATTERN.finditer(text))
    clause_matches = list(_CLAUSE_PATTERN.finditer(text))

    if not clause_matches:
        return [Section(title="Contract", clauses=[Clause(id="1", text=text)])]

    # Build a lookup of section number -> title from header matches
    titles: dict[str, str] = {}
    for h in header_matches:
        titles[h.group("num")] = h.group("title").strip().rstrip(".")

    sections: dict[str, list[Clause]] = {}
    section_order: list[str] = []

    for i, match in enumerate(clause_matches):
        clause_id = match.group("num")
        start = match.end()
        end = clause_matches[i + 1].start() if i + 1 < len(clause_matches) else len(text)
        clause_text = text[start:end].strip()

        if not clause_text:
            continue

        section_num = clause_id.split(".")[0]

        if section_num not in sections:
            sections[section_num] = []
            section_order.append(section_num)

        sections[section_num].append(Clause(id=clause_id, text=clause_text))

    return [
        Section(
            title=f"{num}. {titles.get(num, 'Section ' + num)}",
            clauses=sections[num],
        )
        for num in section_order
    ]


def flatten_clauses(sections: list[Section]) -> list[Clause]:
    """Convenience helper: returns every clause across all sections as a flat list."""
    return [clause for section in sections for clause in section.clauses]

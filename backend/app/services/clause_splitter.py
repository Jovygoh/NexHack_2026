"""
Splits extracted contract text back into numbered clauses.

PDF text extraction often loses original line breaks, so a clause like:
  "1.1 Confidential Information means..."
  "1.2 The Receiving Party agrees..."
ends up as one continuous run-on string. This module re-splits that text
using the numbering pattern (e.g. "1.1", "2.3", "10.4") so the rest of the
pipeline can work clause-by-clause instead of treating the whole contract
as a single blob.

Not every uploaded document is a numbered contract though (study notes,
policy memos, plain prose). For those, split_into_sections() falls back to
a structure-aware split based on the document's own headings (short
ALL-CAPS lines), bullet points, and paragraph breaks — so the result still
mirrors the original document's own layout instead of treating the whole
file as one undifferentiated block.
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

# Heuristic for an unnumbered heading line in unstructured documents, e.g.
# "OFFER", "ACCEPTANCE", "EQUITABLE REMEDIES" — short, no lowercase letters.
_MIN_HEADING_LEN = 2
_MAX_HEADING_LEN = 70

_BULLET_PATTERN = re.compile(r"^\s*[-•]\s+")

# Soft cap on how much running prose text accumulates into a single clause
# before being force-split, so one regex match can never explode across an
# entire multi-paragraph (or multi-page) document.
_MAX_PARAGRAPH_CHARS = 500


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

    Falls back to a structure-aware split (headings / bullets / paragraphs)
    if no numbered-clause pattern is detected — e.g. unstructured contracts,
    or a non-contract document (study notes, articles, reports) that
    happens to contain a few numbers shaped like "1.1" (page refs, statute
    sections, citations) but isn't actually structured as numbered clauses.
    """
    original_text = text
    flat_text = " ".join(text.split())  # normalise whitespace/newlines

    header_matches = list(_SECTION_HEADER_PATTERN.finditer(flat_text))
    clause_matches = list(_CLAUSE_PATTERN.finditer(flat_text))

    if not clause_matches or not _looks_like_real_clause_structure(flat_text, clause_matches, header_matches):
        return _split_unstructured(original_text)

    text = flat_text

    # Build a lookup of section number -> title from header matches
    titles: dict[str, str] = {}
    for h in header_matches:
        titles[h.group("num")] = h.group("title").strip().rstrip(".")

    header_starts = sorted(h.start() for h in header_matches)

    sections: dict[str, list[Clause]] = {}
    section_order: list[str] = []

    # Preserve any preamble text before the first numbered clause (e.g. a
    # document title or recital paragraph) instead of silently dropping it.
    preamble_end = clause_matches[0].start()
    # Don't include the section-1 header itself in the preamble — only
    # genuine preamble text that comes before it, if any.
    for h_start in header_starts:
        if h_start < preamble_end:
            preamble_end = h_start
            break
    preamble_text = text[:preamble_end].strip()
    if preamble_text:
        sections["0"] = [Clause(id="", text=preamble_text)]
        section_order.append("0")

    for i, match in enumerate(clause_matches):
        clause_id = match.group("num")
        start = match.end()
        end = clause_matches[i + 1].start() if i + 1 < len(clause_matches) else len(text)

        # If a section header (e.g. "2. OBLIGATIONS") falls inside this
        # clause's range, it means the next section started here without
        # being immediately followed by a sub-clause match — trim the
        # clause text at that point so the header doesn't bleed into the
        # previous clause's text.
        for h_start in header_starts:
            if start < h_start < end:
                end = h_start
                break

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
            title="" if num == "0" else f"{num}. {titles.get(num, 'Section ' + num)}",
            clauses=sections[num],
        )
        for num in section_order
    ]


def _is_heading_line(line: str) -> bool:
    """
    A line is treated as a heading if it's short and entirely free of
    lowercase letters (e.g. "OFFER", "EQUITABLE REMEDIES") — the same
    convention nearly every plain-text document uses for section titles.
    """
    if not (_MIN_HEADING_LEN <= len(line) <= _MAX_HEADING_LEN):
        return False
    if not re.search(r"[A-Za-z]", line):
        return False
    return not any(c.islower() for c in line)


def _split_unstructured(text: str) -> list[Section]:
    """
    Structure-aware fallback for documents without numbered "1.1"-style
    clauses. Uses the document's own ALL-CAPS heading lines as section
    boundaries, keeps bullet-point list items intact as individual
    clauses, and breaks long running prose into paragraph-sized clauses —
    so the reconstructed view mirrors the original layout instead of
    collapsing the whole file into one block.
    """
    lines = text.split("\n")

    sections: list[Section] = []
    current_title = ""
    current_clauses: list[Clause] = []
    buffer_lines: list[str] = []
    clause_counter = 0

    def flush_buffer() -> None:
        nonlocal buffer_lines, clause_counter
        if buffer_lines:
            joined = " ".join(buffer_lines).strip()
            buffer_lines = []
            if joined:
                clause_counter += 1
                current_clauses.append(Clause(id=str(clause_counter), text=joined))

    def flush_section() -> None:
        nonlocal current_title, current_clauses, clause_counter
        flush_buffer()
        if current_clauses:
            sections.append(Section(title=current_title, clauses=current_clauses))
        current_clauses = []
        clause_counter = 0

    for raw_line in lines:
        line = raw_line.strip()

        if not line:
            flush_buffer()  # blank line marks a paragraph/list-item boundary
            continue

        if _is_heading_line(line):
            flush_section()
            current_title = line
            continue

        if _BULLET_PATTERN.match(line):
            flush_buffer()  # close out whatever came before this list item
            buffer_lines.append(line)
            continue

        # Ordinary text line — extend whatever's currently being built
        # (a wrapped bullet item, or a running paragraph).
        buffer_lines.append(line)
        is_in_bullet = bool(buffer_lines) and bool(_BULLET_PATTERN.match(buffer_lines[0]))
        current_len = sum(len(w) + 1 for w in buffer_lines)
        # Never force-split a bullet item mid-way through — only cap plain
        # prose paragraphs, so list items stay intact.
        if not is_in_bullet and current_len > _MAX_PARAGRAPH_CHARS:
            flush_buffer()

    flush_section()

    if not sections:
        # Nothing recognizable at all (no headings, bullets, or paragraph
        # breaks) — last-resort fallback so the document still renders.
        flat = " ".join(text.split())
        return [Section(title="", clauses=[Clause(id="1", text=flat)])] if flat else []

    return sections


def _looks_like_real_clause_structure(text: str, clause_matches: list, header_matches: list) -> bool:
    """
    Heuristic sanity check to avoid treating non-contract documents
    (study notes, articles, reports with case citations / statute
    references) as if they were structured contracts.

    Requires:
    - At least one real section header (e.g. "1. DEFINITION OF...")
      Most genuine contracts have these; prose documents with stray
      numbers usually don't.
    - Section numbers in the detected clauses are mostly sequential and
      start near 1, rather than scattered/inconsistent (a strong signal
      of real clause numbering vs. coincidental number matches like
      "60A" or "14B" from statute citations).
    """
    if not header_matches:
        return False

    section_nums = []
    for m in clause_matches:
        try:
            section_nums.append(int(m.group("num").split(".")[0]))
        except ValueError:
            continue

    if not section_nums:
        return False

    # Real contracts rarely jump straight to large section numbers without
    # smaller ones appearing first/often. If the spread of distinct section
    # numbers is very large relative to how many clause matches there are,
    # it's more likely coincidental matches from an unstructured document.
    distinct_sections = set(section_nums)
    if len(distinct_sections) > len(clause_matches):
        return False

    if max(distinct_sections) > 25:
        return False

    return True


def flatten_clauses(sections: list[Section]) -> list[Clause]:
    """Convenience helper: returns every clause across all sections as a flat list."""
    return [clause for section in sections for clause in section.clauses]

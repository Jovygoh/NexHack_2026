from __future__ import annotations

import asyncio
import json
import re
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import datetime, timezone
from html.parser import HTMLParser
from pathlib import Path
from typing import Callable


DEFAULT_SOURCE_URL = "https://lom.agc.gov.my/"
GENERATED_FILENAME = "malaysia_law_latest_agc_lom.md"
MANIFEST_FILENAME = "malaysia_law_update_manifest.json"

@dataclass(frozen=True)
class LawLink:
    title: str
    url: str


CORE_MALAYSIA_LAWS: tuple[LawLink, ...] = (
    LawLink(
        title="Act 136 - Contracts Act 1950",
        url="https://lom.agc.gov.my/act-detail.php?type=principal&act=136&lang=BI",
    ),
    LawLink(
        title="Act 265 - Employment Act 1955",
        url="https://lom.agc.gov.my/act-detail.php?type=principal&act=265&lang=BI",
    ),
    LawLink(
        title="Act 709 - Personal Data Protection Act 2010",
        url="https://lom.agc.gov.my/act-detail.php?type=principal&act=709&lang=BI",
    ),
    LawLink(
        title="Act 777 - Companies Act 2016",
        url="https://lom.agc.gov.my/act-detail.php?type=principal&act=777&lang=BI",
    ),
)


class _LinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self._href: str | None = None
        self._text_parts: list[str] = []
        self.links: list[LawLink] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag.lower() != "a":
            return
        attrs_dict = dict(attrs)
        href = attrs_dict.get("href")
        if href:
            self._href = href
            self._text_parts = []

    def handle_data(self, data: str) -> None:
        if self._href:
            self._text_parts.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag.lower() != "a" or not self._href:
            return
        title = " ".join(" ".join(self._text_parts).split())
        if title:
            self.links.append(LawLink(title=title, url=self._href))
        self._href = None
        self._text_parts = []


def _fetch_text(url: str, timeout: int = 20) -> str:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "ContractSense/1.0 (+https://lom.agc.gov.my/)",
            "Accept": "text/html,application/xhtml+xml,application/pdf,*/*",
        },
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        raw = response.read()
        content_type = response.headers.get("content-type", "")
    if "application/pdf" in content_type.lower():
        return ""
    return raw.decode("utf-8", errors="replace")


def _is_law_reference(title: str, url: str) -> bool:
    parsed = urllib.parse.urlparse(url)
    path = parsed.path.lower()
    query = urllib.parse.parse_qs(parsed.query.lower())
    title_text = title.lower()

    if url.endswith("#") or path.endswith("/contact.php"):
        return False
    if path.endswith("/federal-constitution.php"):
        return True
    if path.endswith("/act-detail.php") or path.endswith("/act-view.php"):
        return True
    if path.endswith("/principal.php"):
        return query.get("type", [""])[0] in {
            "updated",
            "repealed",
            "translated",
            "revised",
            "amendment",
            "original",
        }
    if path.endswith("/ordinance.php") or path.endswith("/subsid.php"):
        return True
    return bool(
        re.search(r"\bact\s+\d+\b", title_text)
        or re.search(r"\bp\.?\s*u\.?\s*\([ab]\)", title_text)
    )


def _normalise_links(html: str, source_url: str) -> list[LawLink]:
    parser = _LinkParser()
    parser.feed(html)

    seen: set[str] = set()
    links: list[LawLink] = []
    for link in parser.links:
        absolute_url = urllib.parse.urljoin(source_url, link.url)
        title = re.sub(r"\s+", " ", link.title).strip(" -")
        if not title or absolute_url in seen:
            continue
        if not _is_law_reference(title, absolute_url):
            continue
        seen.add(absolute_url)
        links.append(LawLink(title=title, url=absolute_url))
    return links


def _render_law_markdown(source_url: str, links: list[LawLink], fetched_at: datetime) -> str:
    lines = [
        "# Malaysia Federal Legislation Reference",
        "",
        "Automatically refreshed from the official Attorney General's Chambers",
        f"Laws of Malaysia portal: {source_url}",
        "",
        f"Last refreshed: {fetched_at.astimezone(timezone.utc).isoformat()}",
        "",
        "Use this as a live index for Malaysian law checks. For formal legal",
        "decisions, verify the linked official text and gazette publication.",
        "",
        "## Core ContractSense Malaysian Laws",
        "",
    ]
    for link in CORE_MALAYSIA_LAWS:
        safe_title = link.title.replace("[", "(").replace("]", ")")
        lines.append(f"- [{safe_title}]({link.url})")
    lines.extend([
        "",
        "## Key Compliance Notes Used By Deterministic Rules",
        "",
        "- Employment Act 1955: normal weekly working hours should not exceed 45 hours unless a lawful exception applies.",
        "- Contracts Act 1950 section 28: post-employment restraint of trade/non-compete wording is generally void unless a narrow statutory exception applies.",
        "- Contracts Act 1950 section 75: fixed penalties/liquidated damages should be tied to reasonable compensation and actual loss principles.",
        "- PDPA 2010: personal data processing should be specific, consent-based where required, and not based on blanket waiver of statutory rights.",
        "- Companies Act 2016 is Act 777, not Act 778.",
        "",
        "## Latest And Linked References",
        "",
    ])
    if not links:
        lines.append("No law links were found during the latest refresh.")
    for link in links:
        safe_title = link.title.replace("[", "(").replace("]", ")")
        lines.append(f"- [{safe_title}]({link.url})")
    lines.append("")
    return "\n".join(lines)


def _write_manifest(
    laws_dir: Path,
    *,
    source_url: str,
    fetched_at: datetime,
    status: str,
    message: str,
    links: list[LawLink],
) -> dict:
    manifest = {
        "source_url": source_url,
        "fetched_at": fetched_at.astimezone(timezone.utc).isoformat(),
        "status": status,
        "message": message,
        "generated_file": GENERATED_FILENAME,
        "link_count": len(links),
        "links": [{"title": link.title, "url": link.url} for link in links[:100]],
    }
    laws_dir.mkdir(parents=True, exist_ok=True)
    (laws_dir / MANIFEST_FILENAME).write_text(
        json.dumps(manifest, indent=2),
        encoding="utf-8",
    )
    return manifest


def update_malaysia_law_database(
    laws_dir: Path,
    *,
    source_url: str = DEFAULT_SOURCE_URL,
    fetch_text: Callable[[str], str] = _fetch_text,
) -> dict:
    fetched_at = datetime.now(timezone.utc)
    laws_dir.mkdir(parents=True, exist_ok=True)

    try:
        html = fetch_text(source_url)
        links = _merge_law_links(list(CORE_MALAYSIA_LAWS), _normalise_links(html, source_url))
        content = _render_law_markdown(source_url, links, fetched_at)
        (laws_dir / GENERATED_FILENAME).write_text(content, encoding="utf-8")
        return _write_manifest(
            laws_dir,
            source_url=source_url,
            fetched_at=fetched_at,
            status="ok",
            message=f"Malaysia law reference refreshed with {len(links)} official links.",
            links=links,
        )
    except (OSError, urllib.error.URLError, TimeoutError, ValueError) as exc:
        existing = laws_dir / GENERATED_FILENAME
        message = f"Malaysia law refresh failed: {exc}"
        core_content = _render_law_markdown(source_url, list(CORE_MALAYSIA_LAWS), fetched_at)
        (laws_dir / GENERATED_FILENAME).write_text(core_content, encoding="utf-8")
        return _write_manifest(
            laws_dir,
            source_url=source_url,
            fetched_at=fetched_at,
            status="degraded",
            message=f"{message}. Core official Malaysian law links were retained.",
            links=list(CORE_MALAYSIA_LAWS),
        )


def _merge_law_links(*groups: list[LawLink]) -> list[LawLink]:
    merged: list[LawLink] = []
    seen: set[str] = set()
    for group in groups:
        for link in group:
            key = _law_link_key(link)
            if key in seen:
                continue
            seen.add(key)
            merged.append(link)
    return merged


def _law_link_key(link: LawLink) -> str:
    act_match = re.search(r"\bAct\s*(?:%20|\s)+(\d+)\b", f"{link.title} {link.url}", re.IGNORECASE)
    if act_match:
        return f"act:{act_match.group(1)}"
    return link.url.lower()


def read_malaysia_law_update_status(laws_dir: Path) -> dict:
    manifest_path = laws_dir / MANIFEST_FILENAME
    if not manifest_path.exists():
        return {
            "status": "never_run",
            "message": "Malaysia law database has not been refreshed yet.",
            "generated_file": GENERATED_FILENAME,
            "link_count": 0,
        }
    try:
        return json.loads(manifest_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return {
            "status": "error",
            "message": "Malaysia law update manifest is unreadable.",
            "generated_file": GENERATED_FILENAME,
            "link_count": 0,
        }


async def malaysia_law_update_loop(
    laws_dir: Path,
    *,
    source_url: str,
    interval_hours: int,
) -> None:
    interval_seconds = max(interval_hours, 1) * 60 * 60
    await asyncio.sleep(2)
    while True:
        await asyncio.to_thread(
            update_malaysia_law_database,
            laws_dir,
            source_url=source_url,
        )
        await asyncio.sleep(interval_seconds)


def start_malaysia_law_updater(
    laws_dir: Path,
    *,
    source_url: str,
    interval_hours: int,
    enabled: bool,
) -> None:
    if not enabled:
        return
    loop = asyncio.get_event_loop()
    loop.create_task(
        malaysia_law_update_loop(
            laws_dir,
            source_url=source_url,
            interval_hours=interval_hours,
        )
    )

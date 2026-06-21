from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Literal

from app.models import ClauseFinding
from app.services.clause_splitter import Section, split_into_sections

RiskLevel = Literal["low", "medium", "high", "critical"]


@dataclass(frozen=True)
class RiskRule:
    id: str
    category: str
    title: str
    severity: RiskLevel
    patterns: tuple[str, ...]
    explanation: str
    recommendation: str


RISK_RULES: tuple[RiskRule, ...] = (
    RiskRule(
        id="material-term-changes",
        category="General",
        title="Material term changes",
        severity="medium",
        patterns=(r"material changes", r"substantial modifications"),
        explanation="The contract may allow significant changes to its terms.",
        recommendation="Require written notice, mutual consent, and a right to terminate if material terms change.",
    ),
    RiskRule(
        id="hidden-fees",
        category="Fees and payment",
        title="Potential hidden fees or pass-through charges",
        severity="high",
        patterns=(
            r"additional fees?", r"administrative charges?", r"pass[-\s]?through costs?",
            r"fees .{0,40} subject to change", r"extra charges?", r"separate charges?",
            r"pricing .{0,40} may be adjusted",
        ),
        explanation="The contract may allow extra charges beyond the headline price.",
        recommendation="List all charge categories, caps, approval requirements, and invoice dispute rights.",
    ),
    RiskRule(
        id="broad-liability-waiver",
        category="Liability",
        title="Broad limitation or waiver of liability",
        severity="critical",
        patterns=(
            r"not liable for .{0,40} indirect", r"limitation of liability", r"liability .{0,40} capped",
            r"waive .{0,40} damages", r"exclude .{0,40} damages", r"disclaim .{0,40} liability",
            r"consequential damages",
        ),
        explanation="Liability may be excluded or capped too broadly for enterprise risk tolerance.",
        recommendation="Carve out fraud, confidentiality, data breach, IP infringement, and gross negligence.",
    ),
    RiskRule(
        id="data-use",
        category="Data and privacy",
        title="Broad data use or transfer permission",
        severity="high",
        patterns=(
            r"use .{0,40} data .{0,40} improve", r"share .{0,40} data .{0,40} affiliates?", r"transfer .{0,40} personal data",
            r"process .{0,40} data .{0,40} analytics", r"data .{0,40} third parties", r"personal information .{0,40} affiliates?",
        ),
        explanation="The vendor may use, share, or transfer enterprise/customer data broadly.",
        recommendation="Limit data use to service delivery, require data processing terms, and define retention/deletion duties.",
    ),
    RiskRule(
        id="exclusive-remedy",
        category="Remedies",
        title="Exclusive remedy restriction",
        severity="medium",
        patterns=(
            r"sole and exclusive remedy", r"exclusive remedy", r"limited to .{0,40} remedy", r"only remedy",
        ),
        explanation="Available remedies may be narrowed even when business harm is larger.",
        recommendation="Preserve injunctive relief, statutory rights, and remedies for severe breaches.",
    ),
    RiskRule(
        id="ambiguous-incorporation",
        category="Referenced documents",
        title="Terms incorporated by external reference",
        severity="medium",
        patterns=(
            r"incorporated by reference", r"available at https?://", r"as updated from time to time",
            r"posted on .{0,40} website", r"online terms?", r"external terms?",
        ),
        explanation="Important terms may live outside the uploaded contract and change later.",
        recommendation="Attach referenced terms as exhibits and freeze the applicable version at signature.",
    ),
    # --- NDA / confidentiality-specific rules ---
    RiskRule(
        id="overbroad-confidential-definition",
        category="Confidentiality",
        title="Overbroad definition of confidential information",
        severity="high",
        patterns=(
            r"absolutely all information", r"in any form whatsoever", r"publicly available.{0,40}confidential",
            r"regardless of (?:whether|how) (?:marked|disclosed)",
        ),
        explanation="Defining confidential information to include publicly available or independently developed information is overbroad and may be unenforceable.",
        recommendation="Limit the definition to non-public information that is marked confidential or reasonably understood to be confidential, with standard carve-outs (public domain, independently developed, already known).",
    ),
    RiskRule(
        id="indefinite-duration",
        category="Duration",
        title="Indefinite or permanent contractual obligation",
        severity="high",
        patterns=(
            r"permanently and indefinitely", r"without any expiry date", r"perpetually binding",
            r"remain.{0,20}permanently binding", r"no expiration",
        ),
        explanation="Obligations with no time limit are commercially unusual and may be struck down by courts as an unreasonable restraint.",
        recommendation="Specify a fixed term (commonly 2-5 years for confidentiality) after which obligations lapse, unless renewed by agreement.",
    ),
    RiskRule(
        id="no-legal-disclosure-carveout",
        category="Compliance",
        title="No carve-out for legally required disclosure",
        severity="critical",
        patterns=(
            r"no exception shall apply", r"regardless of.{0,30}court order", r"required by law.{0,30}shall not apply",
            r"including where disclosure is required by law",
        ),
        explanation="A clause that prohibits disclosure even when required by law, court order, or regulator is unenforceable and may expose a party to contempt of court if relied upon.",
        recommendation="Add a standard carve-out permitting disclosure required by law or valid court/regulatory order, with prior notice to the other party where legally permitted.",
    ),
    RiskRule(
        id="disproportionate-penalty",
        category="Remedies",
        title="Disproportionate liquidated damages clause",
        severity="critical",
        patterns=(
            r"liquidated damages.{0,60}regardless of actual loss",
            r"damages of no less than RM\s?[\d,]{4,}",
            r"penalty of (?:RM|USD|\$)\s?[\d,]{4,}",
        ),
        explanation="A fixed damages amount unrelated to actual loss may be treated as an unenforceable penalty rather than a genuine pre-estimate of loss under contract law.",
        recommendation="Tie liquidated damages to a reasonable pre-estimate of loss, or rely on general damages assessed by a court instead of a large fixed figure.",
    ),
)


def analyze_text(text: str) -> list[ClauseFinding]:
    """
    Splits the contract into its real numbered sections/clauses, then runs
    every rule against each clause individually. Returns one ClauseFinding
    per clause (status 'low' if no rule matched, otherwise the matched
    rule's severity) so the full original structure can be reconstructed
    by the frontend.
    """
    sections = split_into_sections(text)
    findings: list[ClauseFinding] = []

    for section in sections:
        section_label = section.title or "General"
        for clause in section.clauses:
            clean = " ".join(clause.text.split())
            if not clean:
                continue

            matched_rule, excerpt, confidence = _match_clause(clean)

            if matched_rule:
                findings.append(
                    ClauseFinding(
                        id=f"{matched_rule.id}-{clause.id}",
                        category=section_label,
                        title=matched_rule.title,
                        severity=matched_rule.severity,
                        confidence=confidence,
                        excerpt=f"{clause.id} {clean}".strip(),
                        explanation=matched_rule.explanation,
                        recommendation=matched_rule.recommendation,
                        line_number=None,
                    )
                )
            else:
                # No issue found — still emit a "low" finding so the clause
                # appears in the reconstructed document as a clean/ok clause.
                findings.append(
                    ClauseFinding(
                        id=f"clean-{clause.id}",
                        category=section_label,
                        title="No issues detected",
                        severity="low",
                        confidence=0.5,
                        excerpt=f"{clause.id} {clean}".strip(),
                        explanation="",
                        recommendation="",
                        line_number=None,
                    )
                )

    return findings


def _match_clause(clean_line: str) -> tuple[RiskRule | None, str, float]:
    for rule in RISK_RULES:
        for pattern in rule.patterns:
            match = re.search(pattern, clean_line, re.IGNORECASE)
            if match:
                return rule, _excerpt_around(clean_line, match.start(), match.end()), 0.82
    return None, clean_line, 0.0


def calculate_risk_score(findings: list[ClauseFinding]) -> int:
    weights = {"low": 0, "medium": 18, "high": 28, "critical": 40}
    score = sum(weights[finding.severity] for finding in findings)
    return min(score, 100)


def risk_level_from_score(score: int) -> RiskLevel:
    if score >= 80:
        return "critical"
    if score >= 55:
        return "high"
    if score >= 25:
        return "medium"
    return "low"


def _excerpt_around(text: str, start: int, end: int, radius: int = 200) -> str:
    left = max(start - radius, 0)
    right = min(end + radius, len(text))
    prefix = "..." if left > 0 else ""
    suffix = "..." if right < len(text) else ""
    return f"{prefix}{text[left:right]}{suffix}"

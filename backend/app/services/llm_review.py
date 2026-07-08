from __future__ import annotations

from app.models import ClauseFinding, LlmReview
from app.services.clause_splitter import split_into_sections, to_numbered_lines
from app.services.llm_client import ProviderConfig, build_provider_chain, call_with_fallback
from app.services.retrieval import build_reference_context

# Per-call contract-text budget. Long contracts are split into multiple
# batches instead of being silently truncated.
REVIEW_BATCH_CHAR_BUDGET = 9000
REVIEW_TEMPERATURE = 0


async def review_with_llm(
    *,
    api_key: str,
    model: str,
    gemini_api_key: str = "",
    gemini_model: str = "",
    contract_text: str,
    findings: list[ClauseFinding],
    jurisdiction: str | None,
    language: str | None,
    laws_text: str = "",
    policies_text: str = "",
    selected_laws: list[str] | None = None,
    include_company_policy: bool = True,
) -> LlmReview | None:
    providers = build_provider_chain(
        openai_api_key=api_key,
        openai_model=model,
        gemini_api_key=gemini_api_key,
        gemini_model=gemini_model,
    )

    if not providers:
        print("[llm_review] No OPENAI_API_KEY or GEMINI_API_KEY configured - using offline mode.")
        return _offline_fallback_review(
            findings,
            selected_laws=selected_laws,
            include_company_policy=include_company_policy,
        )

    try:
        import openai  # noqa: F401
    except ImportError as import_exc:
        print(f"[llm_review] Failed to import OpenAI-compatible client library: {import_exc!r}")
        return _offline_fallback_review(
            findings,
            selected_laws=selected_laws,
            include_company_policy=include_company_policy,
        )

    finding_summary = "\n".join(
        f"- {finding.severity.upper()} {finding.title}: {finding.excerpt}" for finding in findings
    ) or "- No deterministic rule findings."

    laws_context, policies_context = build_reference_context(
        contract_text,
        laws_text,
        policies_text if include_company_policy else "",
        top_k=5,
    )
    batches = _build_review_batches(contract_text, max_chars=REVIEW_BATCH_CHAR_BUDGET)
    scope = _scope_context(selected_laws, include_company_policy)

    try:
        if len(batches) <= 1:
            review_text, used_provider = await _run_single_review(
                providers,
                contract_section=batches[0] if batches else "(No readable contract text.)",
                finding_summary=finding_summary,
                laws_context=laws_context,
                policies_context=policies_context,
                jurisdiction=jurisdiction,
                language=language,
                scope=scope,
            )
        else:
            review_text, used_provider = await _run_batched_review(
                providers,
                batches,
                finding_summary=finding_summary,
                laws_context=laws_context,
                policies_context=policies_context,
                jurisdiction=jurisdiction,
                language=language,
                scope=scope,
            )
        return LlmReview(provider=used_provider.name, model=used_provider.model, review=review_text)
    except Exception as exc:
        print(f"[llm_review] All configured providers failed, falling back to offline mode: {exc!r}")
        return _offline_fallback_review(
            findings,
            exc,
            selected_laws=selected_laws,
            include_company_policy=include_company_policy,
        )


def _scope_context(selected_laws: list[str] | None, include_company_policy: bool) -> dict[str, str]:
    selected_law_label = ", ".join(selected_laws or []) or "No Malaysian law buttons selected"
    policy_scope = "Included" if include_company_policy else "Excluded by user selection"
    return {
        "selected_law_label": selected_law_label,
        "policy_scope": policy_scope,
    }


def _build_review_batches(contract_text: str, *, max_chars: int) -> list[str]:
    sections = split_into_sections(contract_text)
    flat_lines = to_numbered_lines(sections)

    if not flat_lines:
        normalised = " ".join(contract_text.split())
        if not normalised:
            return []
        return [normalised[i:i + max_chars] for i in range(0, len(normalised), max_chars)] or [normalised]

    batches: list[str] = []
    buffer_lines: list[str] = []
    buffer_len = 0
    for line in flat_lines:
        line_len = len(line) + 1
        if buffer_lines and buffer_len + line_len > max_chars:
            batches.append("\n".join(buffer_lines))
            buffer_lines, buffer_len = [], 0
        buffer_lines.append(line)
        buffer_len += line_len
    if buffer_lines:
        batches.append("\n".join(buffer_lines))
    return batches


def _review_prompt(
    contract_section: str,
    finding_summary: str,
    laws_context: str,
    policies_context: str,
    jurisdiction: str | None,
    language: str | None,
    scope: dict[str, str],
    *,
    part_note: str = "",
) -> str:
    return f"""
You are an enterprise contract compliance screening assistant.
Your job is to identify hidden clauses, unusual enterprise risk, and review points.
Do not provide legal advice. Provide practical compliance review guidance.

Jurisdiction: {jurisdiction or "not specified"}
Preferred language: {language or "same as contract/user"}
Selected legal scope: {scope["selected_law_label"]}
Company policy scope: {scope["policy_scope"]}

Only assess the contract against the selected legal scope and the company policy scope above. Do not flag issues under laws or company policy sources that the user excluded.

Grounding rules (follow strictly):
- The contract below is numbered as [Clause X.Y]. Every specific issue you raise MUST cite the exact clause id(s) it comes from, e.g. "(Clause 4.2)". If a point is not tied to a specific clause, say so explicitly instead of inventing a clause number.
- Only use the "Reference Malaysian Laws" and "Reference Company Policy" excerpts below as your law/policy grounding. If something relevant is not covered by them, you may reference well-known Malaysian statute names, but must flag it as "not verified against the uploaded reference database".
- Do not state a fact about the contract that is not present in the text below.
{part_note}

Reference Malaysian Laws database (most relevant excerpts for this contract):
{laws_context or "No Malaysian law database was selected, or no relevant match was found."}

Reference Company Policy rules & regulations (most relevant excerpts for this contract):
{policies_context or "Company policy was not selected, no policy document is linked, or no relevant match was found."}

Deterministic rule-engine findings (already computed - cross-check these against your own read, don't just repeat them):
{finding_summary}

Numbered contract text:
{contract_section}

Return:
1. Executive summary
2. Hidden/risky clauses missed or confirmed - cite clause id for every point
3. Questions for legal/compliance team
4. Recommended negotiation actions
""".strip()


async def _run_single_review(
    providers: list[ProviderConfig],
    *,
    contract_section: str,
    finding_summary: str,
    laws_context: str,
    policies_context: str,
    jurisdiction: str | None,
    language: str | None,
    scope: dict[str, str],
) -> tuple[str, ProviderConfig]:
    prompt = _review_prompt(
        contract_section,
        finding_summary,
        laws_context,
        policies_context,
        jurisdiction,
        language,
        scope,
    )
    return await call_with_fallback(
        providers,
        [{"role": "user", "content": prompt}],
        temperature=REVIEW_TEMPERATURE,
        log_prefix="llm_review",
    )


async def _run_batched_review(
    providers: list[ProviderConfig],
    batches: list[str],
    *,
    finding_summary: str,
    laws_context: str,
    policies_context: str,
    jurisdiction: str | None,
    language: str | None,
    scope: dict[str, str],
) -> tuple[str, ProviderConfig]:
    total = len(batches)
    partial_reviews: list[str] = []
    last_provider: ProviderConfig | None = None

    for idx, batch in enumerate(batches, start=1):
        part_note = (
            f"- This is part {idx} of {total} of a long contract, split by clause. "
            "Only review the clauses shown in THIS part; do not comment on parts not shown."
        )
        prompt = _review_prompt(
            batch,
            finding_summary,
            laws_context,
            policies_context,
            jurisdiction,
            language,
            scope,
            part_note=part_note,
        )
        text, used_provider = await call_with_fallback(
            providers,
            [{"role": "user", "content": prompt}],
            temperature=REVIEW_TEMPERATURE,
            log_prefix="llm_review",
        )
        last_provider = used_provider
        if text.strip():
            partial_reviews.append(f"--- Part {idx}/{total} ---\n{text.strip()}")

    if not partial_reviews:
        return "No response from LLM.", (last_provider or providers[0])

    synthesis_prompt = f"""
You are consolidating {total} partial compliance reviews of ONE long contract (each part covered different, non-overlapping clauses) into a single final review.

Grounding rules:
- Every specific issue must keep its original clause id citation from the partial reviews below.
- Do not invent new issues that are not present in the partial reviews.
- Merge duplicate/overlapping points instead of repeating them.
- Preserve this selected scope: {scope["selected_law_label"]}; company policy: {scope["policy_scope"]}.

Partial reviews:
{chr(10).join(partial_reviews)}

Return ONE consolidated review with these sections:
1. Executive summary
2. Hidden/risky clauses missed or confirmed (with clause id citations)
3. Questions for legal/compliance team
4. Recommended negotiation actions
""".strip()

    text, used_provider = await call_with_fallback(
        providers,
        [{"role": "user", "content": synthesis_prompt}],
        temperature=REVIEW_TEMPERATURE,
        log_prefix="llm_review",
    )
    return (text.strip() or "\n\n".join(partial_reviews)), used_provider


def _offline_fallback_review(
    findings: list[ClauseFinding],
    exc: Exception | None = None,
    *,
    selected_laws: list[str] | None = None,
    include_company_policy: bool = True,
) -> LlmReview:
    critical_count = sum(1 for f in findings if f.severity in ["critical", "high"])
    medium_count = sum(1 for f in findings if f.severity == "medium")

    error_msg = f" ({exc})" if exc else ""
    fallback_review = f"""
### Compliance Review Summary (Offline Fallback Mode)
*Note: AI cloud review is currently offline{error_msg}. Generating local deterministic rule review.*

#### 1. Executive Summary
We have completed a compliance scan of the uploaded contract. A total of {len(findings)} clause analyses were performed, flagging {critical_count} high/critical risk and {medium_count} medium risk items.

#### 2. Key Risk Flags Detected
"""
    flagged = [f for f in findings if f.severity != "low"]
    if flagged:
        for finding in flagged[:5]:
            fallback_review += f"\n- **{finding.title} ({finding.severity.upper()})**: {finding.explanation}\n  *Recommendation*: {finding.recommendation}"
    else:
        fallback_review += "\n- No compliance flags or risks were detected in the contract."

    fallback_review += "\n\n#### 3. Selected Compliance Checklist\n"
    selected_laws = selected_laws or []
    if "Employment Act 1955" in selected_laws:
        fallback_review += "- **Employment Act 1955**: Verify that working hours do not exceed 45 hours/week and overtime/public-holiday/leave terms follow statutory requirements.\n"
    if "PDPA 2010" in selected_laws:
        fallback_review += "- **PDPA 2010**: Confirm there is a clear personal data notice, consent basis where required, and no blanket waiver of statutory rights.\n"
    if "Companies Act 2016" in selected_laws:
        fallback_review += "- **Companies Act 2016**: Check that director/entity authority and execution authority are clearly defined.\n"
    if include_company_policy:
        fallback_review += "- **Company policy**: Compare the contract against the linked internal policy database where policy text is available.\n"
    if not selected_laws and not include_company_policy:
        fallback_review += "- No law or company policy source was selected for this scan.\n"

    return LlmReview(
        provider="local-fallback",
        model="deterministic-heuristics",
        review=fallback_review.strip(),
    )

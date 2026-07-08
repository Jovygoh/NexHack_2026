from __future__ import annotations

from app.models import ClauseFinding, LlmReview


async def review_with_llm(
    *,
    api_key: str,
    model: str,
    gemini_api_key: str = "",
    gemini_model: str = "gemini-1.5-flash",
    contract_text: str,
    findings: list[ClauseFinding],
    jurisdiction: str | None,
    language: str | None,
    laws_text: str = "",
    policies_text: str = "",
    selected_laws: list[str] | None = None,
    include_company_policy: bool = True,
) -> LlmReview | None:

    has_openai = bool(api_key)
    has_gemini = bool(gemini_api_key)
    selected_law_label = ", ".join(selected_laws or []) or "No Malaysian law buttons selected"
    policy_scope = "Included" if include_company_policy else "Excluded by user selection"

    if not has_openai and not has_gemini:
        return _offline_fallback_review(findings, selected_laws=selected_laws, include_company_policy=include_company_policy)

    try:
        from openai import AsyncOpenAI
    except ImportError:
        return _offline_fallback_review(findings, selected_laws=selected_laws, include_company_policy=include_company_policy)

    if has_openai:
        client = AsyncOpenAI(api_key=api_key)
        active_model = model
    else:
        client = AsyncOpenAI(
            api_key=gemini_api_key,
            base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
        )
        active_model = gemini_model or "gemini-1.5-flash"

    clipped_text = contract_text[:12000]
    finding_summary = "\n".join(
        f"- {finding.severity.upper()} {finding.title}: {finding.excerpt}" for finding in findings
    ) or "- No deterministic rule findings."
    prompt = f"""
You are an enterprise contract compliance screening assistant.
Your job is to identify hidden clauses, unusual enterprise risk, and review points.
Do not provide legal advice. Provide practical compliance review guidance.

Jurisdiction: {jurisdiction or "not specified"}
Preferred language: {language or "same as contract/user"}
Selected legal scope: {selected_law_label}
Company policy scope: {policy_scope}

Only assess the contract against the selected legal scope and the company policy scope above. Do not flag issues under laws or company policy sources that the user excluded.

Reference Malaysian Laws database uploaded by the user:
{laws_text or "No Malaysian law database selected for this scan."}

Reference Company Policy rules & regulations uploaded by the user:
{policies_text or "Company policy was not selected or no policy document is linked."}

Rule findings:
{finding_summary}

Contract text:
{clipped_text}

Return:
1. Executive summary
2. Hidden/risky clauses missed or confirmed (especially regarding contradictions with the reference Malaysian laws or Company Policy)
3. Questions for legal/compliance team
4. Recommended negotiation actions
""".strip()

    try:
        response = await client.chat.completions.create(
            model=active_model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
        )
        review_text = response.choices[0].message.content or "No response from LLM."
        provider = "openai" if has_openai else "gemini"
        return LlmReview(provider=provider, model=active_model, review=review_text)
    except Exception as exc:
        # If the AI call fails (bad key, rate limit, network, etc.),
        # don't crash the whole scan — fall back to rule-based findings only.
        return _offline_fallback_review(findings, exc, selected_laws=selected_laws, include_company_policy=include_company_policy)


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
### ⚠️ Compliance Review Summary (Offline Fallback Mode)
*Note: AI cloud review is currently offline{error_msg}. Generating local deterministic rule review.*

#### 1. Executive Summary
We have completed a compliance scan of the uploaded contract. A total of {len(findings)} clause analyses were performed, flagging {critical_count} high/critical risk and {medium_count} medium risk items.

#### 2. Key Risk Flags Detected
"""
    flagged = [f for f in findings if f.severity != "low"]
    if flagged:
        for f in flagged[:5]:
            fallback_review += f"\n- **{f.title} ({f.severity.upper()})**: {f.explanation}\n  *Recommendation*: {f.recommendation}"
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

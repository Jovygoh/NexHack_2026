from __future__ import annotations
from app.models import ClauseFinding, LlmReview

async def review_with_llm(
    *,
    api_key: str,
    model: str,
    contract_text: str,
    findings: list[ClauseFinding],
    jurisdiction: str | None,
    language: str | None,
    laws_text: str = "",
    policies_text: str = "",
) -> LlmReview | None:
    
    if not api_key:
        return None
    try:
        from openai import AsyncOpenAI
    except ImportError:
        return None
    
    client = AsyncOpenAI(api_key=api_key)
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
Reference Malaysian Laws database uploaded by the user:
{laws_text or "No specific law database documents uploaded. Use your general knowledge of Malaysian company law."}
Reference Company Policy rules & regulations uploaded by the user:
{policies_text or "No specific company policy documents uploaded."}
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
<<<<<<< HEAD
    
=======

>>>>>>> origin/main
    try:
        response = await client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
        )
<<<<<<< HEAD
        review_text = response.choices[0].message.content or "No response from LLM."
    except Exception as e:
        review_text = f"Error during LLM review: {str(e)}"
        return LlmReview(provider="openai", model=model, review=review_text)
    return LlmReview(provider="openai", model=model, review=review_text)
=======
        review_text = response.choices[0].message.content or ""
        return LlmReview(provider="openai", model=model, review=review_text)
    except Exception as exc:
        # If the AI call fails (bad key, rate limit, network, etc.),
        # don't crash the whole scan — fall back to rule-based findings only.
        return LlmReview(
            provider="openai",
            model=model,
            review=f"AI review unavailable: {exc}",
        )
>>>>>>> origin/main

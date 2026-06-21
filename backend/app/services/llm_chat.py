from __future__ import annotations

import re

from app.models import ClauseFinding


def _clip_text(value: str, limit: int) -> str:
    value = (value or "").strip()
    if len(value) <= limit:
        return value
    return value[:limit].rsplit(" ", 1)[0] + "\n...[truncated]"


def _format_findings(findings: list[ClauseFinding]) -> str:
    if not findings:
        return "- No deterministic rule findings are available yet."

    return "\n".join(
        (
            f"- {finding.severity.upper()} | {finding.title}\n"
            f"  Category: {finding.category}\n"
            f"  Excerpt: {_clip_text(finding.excerpt, 600)}\n"
            f"  Recommendation: {_clip_text(finding.recommendation, 500)}"
        )
        for finding in findings
    )


def _is_greeting(message: str) -> bool:
    cleaned = re.sub(r"[^a-zA-Z ]+", " ", message).lower().strip()
    return cleaned in {"hi", "hello", "hey", "good morning", "good afternoon", "good evening"}


def _fallback_agent_reply(message: str, contract_text: str, findings: list[ClauseFinding]) -> str:
    """Useful local response when the OpenAI API key is not configured."""
    has_contract = bool((contract_text or "").strip() and contract_text != "No contract scanned yet.")

    if _is_greeting(message):
        if has_contract:
            issue_count = len(findings)
            return (
                "Hi, I am ContractSense AI. I can help explain the scanned contract, "
                f"prioritize the {issue_count} flagged issue{'s' if issue_count != 1 else ''}, "
                "draft safer clause wording, or prepare questions for your legal/compliance team."
            )
        return (
            "Hi, I am ContractSense AI. Upload and scan a contract first, then I can help explain "
            "risky clauses, compare them against Malaysian law or company policy, and suggest edits."
        )

    if not has_contract:
        return (
            "I can help, but I do not have a scanned contract in this chat yet. "
            "Please upload a contract in the Scanner page, run the scan, then ask me about a clause, "
            "risk level, policy conflict, or suggested rewrite."
        )

    if findings:
        top = findings[0]
        return (
            "AI agent mode is available after `OPENAI_API_KEY` is configured. "
            "For now, here is a rule-based summary from the scan:\n\n"
            f"Highest-priority issue: {top.title} ({top.severity}).\n"
            f"Why it matters: {top.explanation}\n"
            f"Suggested action: {top.recommendation}\n\n"
            "Ask about a specific flagged clause and I can summarize the stored scan result."
        )

    return (
        "AI agent mode is available after `OPENAI_API_KEY` is configured. "
        "The current rule scan did not flag risky clauses, but a human compliance review is still recommended "
        "for important contracts."
    )


async def chat_with_llm(
    *,
    api_key: str,
    model: str,
    message: str,
    contract_text: str,
    findings: list[ClauseFinding],
    laws_text: str,
    policies_text: str,
    chat_history: list[dict[str, str]] | None = None,
) -> str:
    if not api_key:
        return _fallback_agent_reply(message, contract_text, findings)

    try:
        from openai import AsyncOpenAI
    except ImportError:
        return _fallback_agent_reply(message, contract_text, findings)

    client = AsyncOpenAI(api_key=api_key)
    clipped_contract = _clip_text(contract_text, 12000) or "No contract has been scanned yet."
    clipped_laws = _clip_text(laws_text, 6000) or "No uploaded law reference documents."
    clipped_policies = _clip_text(policies_text, 6000) or "No uploaded company policy documents."
    finding_summary = _format_findings(findings)

    system_message = f"""
You are ContractSense AI, an agentic contract-compliance assistant for Malaysian business users.

Primary goals:
- Answer the user's latest message directly.
- Help users understand scanned contracts, flagged clauses, Malaysian compliance risks, uploaded policy conflicts, and safer rewrite options.
- Ask a short clarifying question when the user request is ambiguous.
- For greetings or small talk, greet the user and offer useful next actions. Do not jump into random legal findings.
- If no contract has been scanned, explain that you need a scan before contract-specific advice.
- Keep responses concise, practical, and conversational.
- Do not claim to be a lawyer and do not present formal legal advice.
- When discussing law, say "based on the provided scan/reference material" unless the exact source is in the context.
- Prefer structured bullets only when they make the answer easier to use.

Uploaded Malaysian law reference material:
{clipped_laws}

Uploaded company policy/reference material:
{clipped_policies}

Contract Text:
'''
{clipped_contract}
'''

Current Scan Findings:
{finding_summary}
""".strip()

    messages = [{"role": "system", "content": system_message}]
    if chat_history:
        messages.extend(
            item
            for item in chat_history[-12:]
            if item.get("role") in {"user", "assistant"} and item.get("content")
        )
    
    messages.append({"role": "user", "content": message})

    try:
        response = await client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.3,
            max_tokens=700,
        )
        return response.choices[0].message.content or "No response from AI."
    except Exception as e:
        return (
            "I could not reach the AI model right now, so I cannot complete the agent response. "
            f"Technical detail: {str(e)}"
        )
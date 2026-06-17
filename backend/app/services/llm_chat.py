from __future__ import annotations
from app.models import ClauseFinding

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
        return "AI capabilities are not available (missing API key). Please configure OPENAI_API_KEY in the backend .env file."

    try:
        from openai import AsyncOpenAI
    except ImportError:
        return "OpenAI client library is not installed."

    client = AsyncOpenAI(api_key=api_key)
    clipped_contract = contract_text[:12000]
    finding_summary = "\n".join(
        f"- {finding.severity.upper()} {finding.title}: {finding.excerpt}" for finding in findings
    ) or "- No deterministic rule findings."

    # Construct the system instruction and context
    system_message = f"""
You are ContractSense AI, an expert assistant specializing in Malaysian company laws (specifically the Employment Act 1955, PDPA 2010, and Companies Act 2016) and corporate compliance.
Your job is to answer questions about the analyzed contract, explain the compliance issues, suggest edits, and cross-reference relevant company policies or laws.

Reference Malaysian Laws database uploaded by the user:
{laws_text or "No specific law database documents uploaded. Use your general knowledge of Malaysian company law."}

Reference Company Policy rules & regulations uploaded by the user:
{policies_text or "No specific company policy documents uploaded."}

Here is the context of the scanned contract:
Contract Text:
\"\"\"
{clipped_contract}
\"\"\"

Current Scan Findings:
{finding_summary}

Provide clear, helpful, and structured answers. Do not provide formal legal advice, but practical compliance guidance.
"""

    messages = [{"role": "system", "content": system_message}]
    if chat_history:
        messages.extend(chat_history[-10:])
    
    messages.append({"role": "user", "content": message})

    try:
        response = await client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.3,
        )
        return response.choices[0].message.content or "No response from AI."
    except Exception as e:
        return f"Error communicating with AI: {str(e)}"

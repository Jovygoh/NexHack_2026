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
    clipped_contract = contract_text[:12000].strip()
    finding_summary = "\n".join(
        f"- {finding.severity.upper()} {finding.title}: {finding.excerpt}" for finding in findings
    ) or "- No deterministic rule findings."

    # Build the contract context block conditionally so the model isn't
    # confused by an empty pair of triple-quotes when no contract is loaded.
    if clipped_contract:
        contract_context = f"""Here is the context of the scanned contract:
Contract Text:
\"\"\"
{clipped_contract}
\"\"\"

Current Scan Findings:
{finding_summary}"""
    else:
        contract_context = (
            "No contract has been scanned in this conversation yet. "
            "Answer the user's question using your general knowledge of Malaysian "
            "employment, data protection, and company law. If the user's question "
            "would benefit from scanning a specific contract, you may suggest they "
            "upload one in the Scanner, but still give a complete, useful answer "
            "to their current question first."
        )

    # Construct the system instruction and context
    system_message = f"""
You are ContractSense AI, an expert assistant specializing in Malaysian company laws (specifically the Employment Act 1955, PDPA 2010, and Companies Act 2016) and corporate compliance.
Your job is to answer questions about Malaysian contract law and compliance in general, and — when a contract has been scanned — to explain its specific compliance issues, suggest edits, and cross-reference relevant company policies or laws.

Reference Malaysian Laws database uploaded by the user:
{laws_text or "No specific law database documents uploaded. Use your general knowledge of Malaysian company law."}

Reference Company Policy rules & regulations uploaded by the user:
{policies_text or "No specific company policy documents uploaded."}

{contract_context}

Provide clear, helpful, and structured answers. Do not provide formal legal advice, but practical compliance guidance. Always give a complete, substantive answer — never refuse to answer just because no contract has been scanned yet.
""".strip()

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

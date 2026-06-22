from __future__ import annotations
from app.models import ClauseFinding

async def chat_with_llm(
    *,
    api_key: str,
    model: str,
    gemini_api_key: str = "",
    gemini_model: str = "gemini-1.5-flash",
    message: str,
    contract_text: str,
    findings: list[ClauseFinding],
    laws_text: str,
    policies_text: str,
    chat_history: list[dict[str, str]] | None = None,
) -> str:
    has_openai = bool(api_key)
    has_gemini = bool(gemini_api_key)

    if not has_openai and not has_gemini:
        return offline_fallback_chat(
            message=message,
            contract_text=contract_text,
            findings=findings,
            laws_text=laws_text,
            policies_text=policies_text
        )

    try:
        from openai import AsyncOpenAI
    except ImportError:
        return "OpenAI/Gemini client library is not installed."

    if has_openai:
        client = AsyncOpenAI(api_key=api_key)
        active_model = model
    else:
        client = AsyncOpenAI(
            api_key=gemini_api_key,
            base_url="https://generativelanguage.googleapis.com/v1beta/openai/"
        )
        active_model = gemini_model or "gemini-1.5-flash"

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
            model=active_model,
            messages=messages,
            temperature=0.3,
        )
        return response.choices[0].message.content or "No response from AI."
    except Exception as e:
        return offline_fallback_chat(
            message=message,
            contract_text=contract_text,
            findings=findings,
            laws_text=laws_text,
            policies_text=policies_text,
            error=e
        )


def offline_fallback_chat(
    *,
    message: str,
    contract_text: str,
    findings: list[ClauseFinding],
    laws_text: str,
    policies_text: str,
    error: Exception | None = None
) -> str:
    import re

    message_lower = message.lower()
    
    # 1. Search contract findings
    matched_findings = []
    for f in findings:
        title_words = set(re.findall(r'\w+', f.title.lower()))
        query_words = set(re.findall(r'\w+', message_lower))
        common_words = title_words.intersection(query_words) - {'the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'to', 'for', 'with', 'by'}
        if common_words or any(word in f.title.lower() or word in f.explanation.lower() for word in ['liability', 'fee', 'charge', 'term', 'renewal', 'remedy', 'privacy', 'data', 'confidential']):
            if any(word in message_lower for word in ['liability', 'fee', 'charge', 'term', 'renewal', 'remedy', 'privacy', 'data', 'confidential', f.title.lower()]):
                matched_findings.append(f)
                
    # 2. Search reference texts
    law_info = []
    if laws_text:
        paragraphs = laws_text.split('\n\n')
        for p in paragraphs:
            if any(word in p.lower() for word in ['employment', 'working hours', 'overtime', 'ot', 'maternity', 'paternity', 'leave', 'notice', 'probation', 'salary', 'wages', 'pdpa', 'consent', 'companies act', 'director', 'shareholder']):
                query_words = [w for w in message_lower.split() if len(w) > 3]
                if any(qw in p.lower() for qw in query_words):
                    law_info.append(p[:300].strip() + ("..." if len(p) > 300 else ""))

    # 3. Malaysian Law Heuristics
    malaysian_law_highlights = []
    if any(w in message_lower for w in ['employ', 'hour', 'overtime', 'ot', 'leave', 'maternity', 'paternity', 'notice', 'probation', 'salary', 'wages', 'rest day', 'holiday', 'terminat']):
        malaysian_law_highlights.append(
            "**Employment Act 1955 (Malaysia):**\n"
            "- **Working Hours**: Limited to 45 hours per week max (amended in 2022).\n"
            "- **Overtime Rates**: 1.5x hourly rate on normal days, 2.0x on rest days, and 3.0x on public holidays.\n"
            "- **Maternity & Paternity**: Maternity leave is 98 days; paternity leave is 7 days (both updated in 2022).\n"
            "- **Notice of Termination**: Statutory notice is 4 weeks (<2 yrs service), 6 weeks (2-5 yrs), or 8 weeks (5+ yrs) if not defined."
        )
    if any(w in message_lower for w in ['pdpa', 'data', 'privacy', 'consent', 'personal', 'disclosure', 'transfer']):
        malaysian_law_highlights.append(
            "**Personal Data Protection Act (PDPA) 2010 (Malaysia):**\n"
            "- **Consent Principle**: Explicit written consent is required to process sensitive personal data.\n"
            "- **Notice & Choice**: Data subjects must be informed in writing about the types of data collected and purpose of processing.\n"
            "- **Security Principle**: Adequate security measures must be implemented to prevent unauthorized access or loss.\n"
            "- **Transfer Principle**: Personal data cannot be transferred outside Malaysia unless the destination country is officially gazetted."
        )
    if any(w in message_lower for w in ['company', 'companies act', 'director', 'secretary', 'audit', 'shareholder', 'board']):
        malaysian_law_highlights.append(
            "**Companies Act 2016 (Malaysia):**\n"
            "- **Directors**: A private company can be incorporated with just a single resident director.\n"
            "- **Director Duties**: Directors must act in good faith and in the best interests of the company at all times.\n"
            "- **Company Secretary**: A qualified, licensed company secretary must be appointed within 30 days of incorporation."
        )

    # Compile the final answer
    err_text = f" ({error})" if error else ""
    res = [
        "### ⚠️ ContractSense AI (Offline Fallback Mode)\n"
        f"I am currently operating in offline fallback mode because the cloud AI service is unavailable{err_text}. "
        "Here is the local information extracted from your scanned contract and Malaysian legal reference databases:\n"
    ]
    
    if matched_findings:
        res.append("#### 🔍 Matched Findings from Scanned Contract:")
        for mf in matched_findings[:3]:
            res.append(f"- **{mf.title}** ({mf.severity.upper()}): {mf.explanation}\n  *Recommended remediation*: {mf.recommendation}")
        res.append("")
        
    if law_info:
        res.append("#### 📄 Matching Reference Database Excerpts:")
        for li in law_info[:2]:
            res.append(f"> {li}")
        res.append("")
        
    if malaysian_law_highlights:
        res.append("#### ⚖️ Relevant Malaysian Law Reference Guides:")
        res.extend(malaysian_law_highlights)
    
    if not matched_findings and not law_info and not malaysian_law_highlights:
        res.append(
            "#### 💡 How can I help?\n"
            "You can ask me questions about:\n"
            "- **Employment terms**: working hours, overtime pay (OT), maternity/paternity leave, and termination notice.\n"
            "- **PDPA 2010**: data processing consent, security rules, and third-party data transfer.\n"
            "- **Companies Act 2016**: director duties, audit rules, and incorporation."
        )
        
    return "\n".join(res)

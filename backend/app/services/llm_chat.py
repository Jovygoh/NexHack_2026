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
    
    # 1. Topic Matching & Guides
    topics = []
    
    # Non-compete and restraint of trade
    if any(w in message_lower for w in ['non-compete', 'restraint', 'compete', 'geographic', 'restraint of trade']):
        topics.append(
            "### ⚖️ Enforceability of Non-Compete Clauses in Malaysia\n\n"
            "Under **Section 28 of the Contracts Act 1950**, any agreement by which anyone is restrained from "
            "exercising a lawful profession, trade, or business of any kind, is to that extent **void**.\n\n"
            "**Key Principles:**\n"
            "- **Post-Employment Restrictions**: Post-employment non-compete restrictions are generally **unenforceable** in Malaysia. "
            "Unlike other jurisdictions, Malaysian courts do not apply a test of 'reasonableness' to post-employment restrictions.\n"
            "- **Exceptions**: Section 28 has three narrow statutory exceptions: sale of goodwill of a business, agreements "
            "between partners prior to dissolution, and agreements during the continuance of a partnership.\n"
            "- **Remedy**: Focus on robust **Confidentiality (NDA)** and **Non-Solicitation** clauses instead of strict non-compete terms, "
            "as protection of proprietary trade secrets and client databases is legally enforceable."
        )

    # Employment Act
    if any(w in message_lower for w in ['employ', 'hour', 'overtime', 'ot', 'leave', 'maternity', 'paternity', 'notice', 'probation', 'salary', 'wages', 'rest day', 'holiday', 'workweek']):
        topics.append(
            "### 📋 Malaysian Employment Act 1955 Compliance Guide\n\n"
            "Following the recent **Employment (Amendment) Act 2022**, key statutory protections apply to all employees:\n\n"
            "- **Maximum Workweek**: Reduced from 48 hours to **45 hours per week** (Section 60A).\n"
            "- **Maternity & Paternity Leave**: Maternity leave increased to **98 days** (Section 37); paternity leave introduced at **7 consecutive days** (Section 60FA) for married male employees.\n"
            "- **Overtime Rates**: Calculated as a minimum of **1.5x** hourly rate for work exceeding normal hours, **2.0x** for work on rest days, and **3.0x** for work on public holidays.\n"
            "- **Notice Periods**: If not specified in the contract, statutory notice periods apply under Section 12:\n"
            "  * Less than 2 years of service: **4 weeks** notice\n"
            "  * 2 to 5 years of service: **6 weeks** notice\n"
            "  * 5 years or more: **8 weeks** notice"
        )

    # PDPA 2010
    if any(w in message_lower for w in ['pdpa', 'data', 'privacy', 'consent', 'personal', 'disclosure', 'transfer', 'sensitive']):
        topics.append(
            "### 🔒 Personal Data Protection Act (PDPA) 2010 Checklist\n\n"
            "In Malaysia, commercial processing of personal data is governed by the PDPA 2010. Any contract involving "
            "data processing must comply with the 7 Data Protection Principles:\n\n"
            "1. **Consent Principle**: Personal data cannot be processed without the subject's explicit consent. Sensitive data (e.g. health, political opinions) requires **written consent**.\n"
            "2. **Notice & Choice Principle**: Data subjects must be informed via a written notice (in Malay and English) explaining what data is collected, the purpose, and their right to request access.\n"
            "3. **Disclosure Principle**: Data cannot be disclosed to third parties without consent, unless exception applies.\n"
            "4. **Security Principle**: Adequate technical and organizational measures must protect data from loss, misuse, or modification.\n"
            "5. **Retention Principle**: Data must not be kept longer than necessary for the fulfillment of its purpose.\n"
            "6. **Data Integrity Principle**: Reasonable steps must be taken to ensure personal data is accurate, complete, and up to date.\n"
            "7. **Access Principle**: Subjects must be given the right to access and correct their personal data."
        )

    # Companies Act 2016
    if any(w in message_lower for w in ['company', 'companies act', 'director', 'secretary', 'audit', 'shareholder', 'board', 'incorporat']):
        topics.append(
            "### 🏢 Companies Act 2016 Compliance Overview\n\n"
            "For corporate governance and contract authority in Malaysia:\n\n"
            "- **Execution of Documents**: Under **Section 66**, a company can execute a contract either under its common seal, "
            "or by signatures of two authorized directors, or one director and the company secretary.\n"
            "- **Director Duties**: Under **Section 213**, directors must exercise their powers for a proper purpose, in good faith, "
            "and in the best interest of the company. Standard indemnity clauses cannot exempt directors from liability for breach of duty.\n"
            "- **Company Secretary**: Every Malaysian company must appoint a licensed company secretary within 30 days of incorporation (Section 235)."
        )

    # Liability & Liquidated Damages
    if any(w in message_lower for w in ['liability', 'damages', 'penalty', 'fine', 'compensat', 'liquidated']):
        topics.append(
            "### 💰 Liability and Liquidated Damages (Section 75)\n\n"
            "Under **Section 75 of the Contracts Act 1950**, clauses that stipulate a fixed penalty amount for breach of contract "
            "are subjected to strict judicial scrutiny in Malaysia:\n\n"
            "- **No Automatic Enforcement**: Even if a contract specifies a fixed penalty (e.g. 'RM 100,000 fine for breach'), "
            "the claiming party cannot automatically recover the full amount. They must prove actual damage suffered.\n"
            "- **Reasonable Compensation**: The court will award 'reasonable compensation' not exceeding the specified amount, "
            "regardless of whether actual damage is proven, but the award must be proportionate.\n"
            "- **Best Practice**: Tie liquidated damages to a genuine pre-estimate of loss (e.g. daily delay rate matching actual cost) "
            "rather than choosing an arbitrary large penalty, to avoid the clause being struck down as unenforceable."
        )

    # 2. Match Scanned Contract Findings
    matched_findings = []
    for f in findings:
        title_words = set(re.findall(r'\w+', f.title.lower()))
        query_words = set(re.findall(r'\w+', message_lower))
        common_words = title_words.intersection(query_words) - {'the', 'a', 'an', 'and', 'or', 'of', 'in', 'on', 'to', 'for', 'with', 'by'}
        if common_words or any(word in f.title.lower() or word in f.explanation.lower() for word in ['liability', 'fee', 'charge', 'term', 'renewal', 'remedy', 'privacy', 'data', 'confidential', 'penalty']):
            matched_findings.append(f)

    # 3. Compile the Answer
    res = [
        "### 🤖 ContractSense AI (Compliance Assistant)\n"
    ]
    
    # If the user asks about the scanned contract specifically or we have matches
    is_asking_about_contract = any(w in message_lower for w in ['contract', 'document', 'file', 'this agreement', 'scanned', 'findings', 'issues', 'violations'])
    
    if is_asking_about_contract or (matched_findings and not topics):
        if findings:
            res.append(
                "Based on the analysis of the scanned contract, here are the compliance issues found:\n"
            )
            for f in findings:
                law_info = f" ({f.law_section})" if f.law_section else ""
                res.append(
                    f"#### ⚠️ {f.title} ({f.severity.upper()}){law_info}\n"
                    f"- **Issue**: {f.explanation}\n"
                    f"- **Recommendation**: {f.recommendation}\n"
                )
                if f.rewrite:
                    res.append(f"- **Suggested Compliant Rewrite**:\n  ```text\n  {f.rewrite}\n  ```\n")
        else:
            res.append(
                "I reviewed the scanned contract and found no compliance violations. "
                "The clauses align with the standard compliance rules for Malaysian contract law."
            )
    elif matched_findings:
        res.append("Here are the specific findings from your scanned contract related to your question:\n")
        for f in matched_findings[:2]:
            law_info = f" ({f.law_section})" if f.law_section else ""
            res.append(
                f"#### ⚠️ {f.title} ({f.severity.upper()}){law_info}\n"
                f"- **Issue**: {f.explanation}\n"
                f"- **Recommendation**: {f.recommendation}\n"
            )
            if f.rewrite:
                res.append(f"- **Suggested Compliant Rewrite**:\n  ```text\n  {f.rewrite}\n  ```\n")
        res.append("---")
        
    # Append general topic guides if matched
    if topics:
        res.extend(topics)
        
    # General default answer if nothing matched
    if not topics and not matched_findings and not is_asking_about_contract:
        res.append(
            "Welcome to ContractSense compliance assistant! I specialize in Malaysian company and contract laws. "
            "Here is a quick overview of key compliance points to check in your agreements:\n\n"
            "1. **Governing Law**: Ensure your contract is explicitly governed by the laws of Malaysia and disputes are referred to Malaysian courts or AIAC (Asian International Arbitration Centre).\n"
            "2. **Unilateral Termination / Modifications**: Clauses giving one party sole discretion to alter terms, fees, or terminate without notice are highly risky and may violate Section 10 of the Contracts Act 1950.\n"
            "3. **Confidentiality / Non-Compete**: Keep post-employment restrictions out, and focus on protecting trade secrets via robust NDA/Non-Solicitation clauses instead (due to Section 28 restraint rules).\n"
            "4. **Data Protection (PDPA 2010)**: Any sharing or processing of personal data requires clear notice and consent mechanisms.\n\n"
            "Please upload a contract to scan for precise compliance checks. Once uploaded, you can ask me any question about the scanned contract, or ask general questions about the Employment Act 1955, PDPA 2010, or Contracts Act 1950!"
        )
        
    return "\n".join(res)

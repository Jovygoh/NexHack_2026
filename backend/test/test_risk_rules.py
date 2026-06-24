from app.services.risk_rules import analyze_text, calculate_risk_score, risk_level_from_score


def test_detects_hidden_terms() -> None:
    text = """
    1. GENERAL TERMS
    1.1 The provider may change the pricing at its sole discretion without prior notice.
    1.2 This agreement will automatically renew unless the customer gives written notice.
    """

    findings = analyze_text(text)

    ids = {finding.id for finding in findings}
    assert any(fid.startswith("unilateral-change") for fid in ids)
    assert any(fid.startswith("auto-renewal") for fid in ids)


def test_detects_english_hidden_fees_and_liability() -> None:
    text = """
    1. FEES AND LIABILITY
    1.1 Provider may charge additional fees and administrative charges.
    1.2 The limitation of liability is capped at one month of fees.
    """

    findings = analyze_text(text)

    ids = {finding.id for finding in findings}
    assert any(fid.startswith("hidden-fees") for fid in ids)
    assert any(fid.startswith("broad-liability-waiver") for fid in ids)


def test_risk_score_maps_to_level() -> None:
    findings = analyze_text("The agreement may modify terms at any time without prior notice.")

    score = calculate_risk_score(findings)

    assert score > 0
    assert risk_level_from_score(score) in {"medium", "high", "critical"}


def test_flat_clause_splitting() -> None:
    from app.services.clause_splitter import split_into_sections
    text = """
    NOW therefore it is hereby agreed as follows:
    1. In consideration of the payments to be made to the Service Provider.
    2. The Institute shall pay the Service Provider such sums.
    3. The Quality of performance related to the work is the essence.
    """
    sections = split_into_sections(text)
    assert len(sections) == 3
    assert sections[0].title == ""
    assert len(sections[0].clauses) == 1
    assert sections[0].clauses[0].id == "1"
    assert sections[0].clauses[0].text == "In consideration of the payments to be made to the Service Provider."
    assert sections[1].clauses[0].id == "2"
    assert sections[2].clauses[0].id == "3"
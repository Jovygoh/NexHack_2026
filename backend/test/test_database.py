import pytest
from app.db import init_db, save_contract, get_all_contracts, get_contract_by_id, delete_contract, clear_all_contracts

def test_db_crud():
    # Setup
    init_db()
    clear_all_contracts()
    
    # Pre-condition check
    assert len(get_all_contracts()) == 0
    
    # Create record data
    record = {
        "file_name": "test_contract_nda.pdf",
        "company": "Test Company Sdn. Bhd.",
        "risk_score": 35,
        "risk_level": "medium",
        "summary": "Found 1 medium risk clause.",
        "findings": [
            {
                "id": "c1",
                "category": "Liability",
                "title": "Uncapped liability",
                "severity": "medium",
                "confidence": 0.85,
                "excerpt": "Vendor shall be liable for all damages.",
                "explanation": "No cap on liability.",
                "recommendation": "Add a cap."
            }
        ],
        "llm_review": {
            "provider": "local",
            "model": "local-fallback",
            "review": "Executive review text."
        },
        "contract_text": "This Agreement between Test Company Sdn. Bhd. and other party...",
        "pdf_base64": "YmFzZTY0",
        "page_sizes": [{"width": 595.0, "height": 842.0}],
        "highlight_boxes": [
            {
                "finding_id": "c1",
                "page": 0,
                "x0": 100.0,
                "x1": 200.0,
                "top": 500.0,
                "bottom": 520.0,
                "severity": "medium"
            }
        ]
    }
    
    # Save contract
    db_id = save_contract(record)
    assert db_id is not None
    assert db_id > 0
    
    # Query contract details
    db_record = get_contract_by_id(db_id)
    assert db_record is not None
    assert db_record["file_name"] == "test_contract_nda.pdf"
    assert db_record["company"] == "Test Company Sdn. Bhd."
    assert db_record["status"] == "issues" # Medium maps to 'issues'
    assert len(db_record["findings"]) == 1
    assert db_record["findings"][0]["title"] == "Uncapped liability"
    assert db_record["llm_review"]["provider"] == "local"
    assert db_record["pdf_base64"] == "YmFzZTY0"
    assert len(db_record["page_sizes"]) == 1
    assert len(db_record["highlight_boxes"]) == 1
    assert db_record["highlight_boxes"][0]["finding_id"] == "c1"
    assert db_record["is_automated"] is False
    
    # Query list
    contracts_list = get_all_contracts()
    assert len(contracts_list) == 1
    assert contracts_list[0]["id"] == db_id
    assert contracts_list[0]["filename"] == "test_contract_nda.pdf"
    assert contracts_list[0]["company"] == "Test Company Sdn. Bhd."
    assert contracts_list[0]["status"] == "issues"
    
    # Clean up
    delete_contract(db_id)
    assert get_contract_by_id(db_id) is None
    assert len(get_all_contracts()) == 0

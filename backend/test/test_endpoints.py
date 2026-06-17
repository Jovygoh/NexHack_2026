import os
import shutil
from fastapi.testclient import TestClient
from app.main import app, LAWS_DIR, POLICIES_DIR

client = TestClient(app)
def test_health_endpoint() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "Enterprise Contract Compliance API"}
def test_reference_endpoints() -> None:
    # Clear directory first
    for filepath in LAWS_DIR.glob("*"):
        filepath.unlink()
    for filepath in POLICIES_DIR.glob("*"):
        filepath.unlink()
    # Verify lists are empty initially
    response = client.get("/api/reference/files")
    assert response.status_code == 200
    assert len(response.json()["laws"]) == 0
    assert len(response.json()["policies"]) == 0
    # Test uploading a law reference file
    law_file_content = b"This is the Employment Act 1955 content text."
    files = {"file": ("employment_act_1955.txt", law_file_content, "text/plain")}
    data = {"type": "law"}
    
    response = client.post("/api/reference/upload", files=files, data=data)
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "filename": "employment_act_1955.txt", "type": "law"}
    # Test uploading a policy reference file
    policy_file_content = b"This is the Company HR Handbook content text."
    files = {"file": ("hr_handbook.txt", policy_file_content, "text/plain")}
    data = {"type": "policy"}
    
    response = client.post("/api/reference/upload", files=files, data=data)
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "filename": "hr_handbook.txt", "type": "policy"}
    # Verify lists contain uploaded files
    response = client.get("/api/reference/files")
    assert response.status_code == 200
    assert len(response.json()["laws"]) == 1
    assert response.json()["laws"][0]["name"] == "employment_act_1955.txt"
    assert len(response.json()["policies"]) == 1
    assert response.json()["policies"][0]["name"] == "hr_handbook.txt"
    # Test deleting the files
    response = client.delete("/api/reference/files/law/employment_act_1955.txt")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "filename": "employment_act_1955.txt", "type": "law"}
    response = client.delete("/api/reference/files/policy/hr_handbook.txt")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "filename": "hr_handbook.txt", "type": "policy"}
    # Verify they are deleted
    response = client.get("/api/reference/files")
    assert response.status_code == 200
    assert len(response.json()["laws"]) == 0
    assert len(response.json()["policies"]) == 0
def test_chat_endpoint_no_key() -> None:
    # Testing chat endpoint behaviour when OPENAI_API_KEY is not configured
    payload = {
        "message": "Hello ContractSense AI",
        "contract_text": "Clause 1. Permanent employment starting 2026.",
        "findings": [],
        "chat_history": []
    }
    
    response = client.post("/api/chat", json=payload)
    assert response.status_code == 200
    # Since API key is blank, it should return the API key warning message
    reply = response.json()["reply"]
    assert "missing API key" in reply or "AI capabilities are not available" in reply

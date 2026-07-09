from app import db


def test_company_policy_snapshot_round_trip(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DB_PATH", tmp_path / "contractsense.db")
    db.init_db()

    policy_id = db.save_company_policy_snapshot({
        "source_url": "https://1drv.ms/w/s!policy",
        "download_url": "https://onedrive.live.com/download?resid=policy",
        "version": 3,
        "content_text": "Employees must obtain approval before disclosing personal data.",
        "checksum": "abc123",
        "etag": "v3",
        "last_modified": "Thu, 09 Jul 2026 10:00:00 GMT",
    })

    active_policy = db.get_active_company_policy()

    assert policy_id > 0
    assert active_policy is not None
    assert active_policy["version"] == 3
    assert "disclosing personal data" in active_policy["content_text"]


def test_company_policy_snapshots_can_be_added_edited_and_removed(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DB_PATH", tmp_path / "contractsense.db")
    db.init_db()

    first_id = db.save_company_policy_snapshot({
        "source_url": "https://example.com/old-policy.txt",
        "download_url": "https://example.com/old-policy.txt",
        "version": 1,
        "content_text": "Old policy text",
    })
    second_id = db.save_company_policy_snapshot({
        "source_url": "https://example.com/new-policy.txt",
        "download_url": "https://example.com/new-policy.txt",
        "version": 2,
        "content_text": "New policy text",
    })

    active_policies = db.list_company_policies()
    assert [policy["id"] for policy in active_policies] == [second_id, first_id]

    assert db.update_company_policy_text(first_id, "Edited old policy text")
    edited_policy = db.get_company_policy_by_id(first_id)
    assert edited_policy is not None
    assert edited_policy["content_text"] == "Edited old policy text"

    assert db.delete_company_policy(second_id)
    active_policies = db.list_company_policies()
    assert [policy["id"] for policy in active_policies] == [first_id]

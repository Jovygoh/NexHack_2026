from app.services.malaysia_law_updater import (
    GENERATED_FILENAME,
    CORE_MALAYSIA_LAWS,
    read_malaysia_law_update_status,
    update_malaysia_law_database,
)


def test_update_malaysia_law_database_writes_generated_reference(tmp_path):
    html = """
    <html>
      <body>
        <a href="/ilims/upload/portal/akta/LOM/EN/Act%20265.pdf">Act 265 - Employment Act 1955</a>
        <a href="/portal/latest">Today</a>
        <a href="/ilims/upload/portal/akta/LOM/EN/Act%20709.pdf">Act 709 - Personal Data Protection Act 2010</a>
      </body>
    </html>
    """

    manifest = update_malaysia_law_database(
        tmp_path,
        source_url="https://lom.agc.gov.my/",
        fetch_text=lambda _url: html,
    )

    generated = tmp_path / GENERATED_FILENAME
    assert manifest["status"] == "ok"
    assert manifest["link_count"] == len(CORE_MALAYSIA_LAWS)
    assert generated.exists()
    content = generated.read_text(encoding="utf-8")
    assert "Contracts Act 1950" in content
    assert "Employment Act 1955" in content
    assert "Personal Data Protection Act 2010" in content
    assert "Companies Act 2016" in content
    assert "Act 777" in content
    assert "Act 778 - Companies Act 2016" not in content


def test_update_status_handles_never_run(tmp_path):
    status = read_malaysia_law_update_status(tmp_path)
    assert status["status"] == "never_run"
    assert status["link_count"] == 0


def test_update_retains_core_laws_when_fetch_fails(tmp_path):
    def broken_fetch(_url):
        raise OSError("offline")

    manifest = update_malaysia_law_database(tmp_path, fetch_text=broken_fetch)

    assert manifest["status"] == "degraded"
    assert manifest["link_count"] == len(CORE_MALAYSIA_LAWS)
    content = (tmp_path / GENERATED_FILENAME).read_text(encoding="utf-8")
    assert "Act 136 - Contracts Act 1950" in content
    assert "Act 709 - Personal Data Protection Act 2010" in content

# Enterprise Contract Compliance Backend

FastAPI backend for checking uploaded contract files for hidden or risky clauses.

## Step 1: Create the environment

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Step 2: Configure environment variables

Copy `.env.example` to `.env`, then adjust the values.

```powershell
Copy-Item .env.example .env
```

Important values:

- `FRONTEND_ORIGINS`: comma-separated frontend URLs allowed by CORS.
- `OPENAI_API_KEY`: optional. If omitted, the backend still runs deterministic rule checks.
- `OPENAI_MODEL`: optional model name for LLM review.

## Step 3: Run locally

```powershell
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Health check:

```text
GET http://127.0.0.1:8000/health
```

Visual test page:

```text
http://127.0.0.1:8000/static/test-upload.html
```

## Step 4: Frontend API call

Your Vercel frontend can send the uploaded file as `multipart/form-data`.

```ts
const formData = new FormData();
formData.append("file", selectedFile);
formData.append("jurisdiction", "Malaysia");
formData.append("language", "en");

const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/contracts/analyze`, {
  method: "POST",
  body: formData,
});

const report = await res.json();
```

Expected response shape:

```json
{
  "file_name": "contract.pdf",
  "summary": "Found 3 potential hidden/risky clauses.",
  "risk_score": 68,
  "risk_level": "high",
  "findings": [],
  "llm_review": null
}
```

## Step 5: Deploy

Common deployment options:

- Render / Railway / Fly.io for a long-running FastAPI service.
- AWS Lambda / Google Cloud Run for serverless container deployment.

After deployment, set this in Vercel:

```text
NEXT_PUBLIC_API_URL=https://your-backend-domain
```

## Compliance Note

This backend is a screening assistant, not legal advice. Final review should be performed by qualified legal/compliance staff.

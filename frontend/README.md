# ContractSense

ContractSense is a hackathon prototype for checking uploaded contract clauses against Malaysian law and company policy.

## Current structure

- `index.html` - page markup and UI layout
- `styles.css` - visual styling
- `data.js` - demo-only analysis data used to show the UI result format
- `app.js` - page routing, upload scanner flow, result rendering, local scan history, and chat interactions

## Prototype flow

1. User uploads a contract.
2. The scanner shows a progress flow.
3. The prototype renders a clause-level demo analysis for the uploaded filename.
4. The scan is saved into browser `localStorage` and appears in History.

The bundled contract example is only a UI demo template. In the final product, uploaded contracts should be analysed by a backend service and only the user's scans should be stored in history.

## Run locally

Open `index.html` in a browser. For a more realistic setup, serve the folder with a local static server.

## Recommended next build steps

1. Add a backend API for document upload and analysis.
2. Extract PDF/DOCX text on the backend.
3. Compare extracted clauses against Malaysian law rules and company policy rules.
4. Return clause-level findings with severity, source law/policy, explanation, and suggested rewrite.
5. Save each user's scan result to a database-backed history table.
6. Add audit logs and a human review flow, because legal compliance results should be reviewed before use.

## Suggested backend endpoints

- `POST /api/analyse` - upload a contract and selected rule sets, then return analysis results
- `GET /api/rules` - list available Malaysian law and company policy rule sets
- `GET /api/scans/:id` - retrieve a previous scan

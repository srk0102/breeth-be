# Breeth Core BE — Local dev README

Quick notes to run and test the socket-driven transcription flow locally.

Prereqs
- Node 18+ and npm
- Optional: AWS credentials + `S3_BUCKET` if you want to test real S3. Otherwise we use a local file-backed S3 adapter.

Install

```bash
npm install
```

Run

Use the local file-backed S3 adapter for development:

```bash
USE_LOCAL_S3=1 npm run start
```

APIs
- Upload: POST /<APP_NAME>/runners/upload (multipart `file` or JSON `{ link }` or `{ s3Url }`) — protected by JWT
- Presign: POST /<APP_NAME>/runners/presign — protected by JWT
- Result: GET /<APP_NAME>/runners/result/:jobId
- Status stream (SSE): GET /<APP_NAME>/runners/status/:jobId
- Connections history: GET /<APP_NAME>/runners/connections/:jobId

Socket client
- Use `scripts/socketClient.html` to subscribe to job updates (open it in a browser). It will auto-disconnect when the job completes.

Troubleshooting
- If S3 artifact uploads fail, set `USE_LOCAL_S3=1` or configure valid AWS credentials and a reachable `S3_BUCKET`.
- Connection logs have TTL controlled by `CONNECTION_LOG_TTL_SECONDS` (defaults to 7 days).

Testing
- Upload a sample file using the upload API or run `scripts/testLocalOnly.js`.
- Run the simulated processing (mocked transcription) with:

```bash
npx babel-node ./scripts/simulateJobComplete.js
```

Retrieve connection history:

```bash
curl http://localhost:8000/<APP_NAME>/runners/connections/<jobId>
```

Testing sockets and end-to-end flow (local)
-----------------------------------------

1) Start server (local S3 adapter):

```bash
USE_LOCAL_S3=1 npm run start
```

2) Upload a local sample (example using curl). Replace <APP_NAME> with your app namespace from `config` and provide an Authorization header if your verifyToken middleware requires one. This returns a jobId.

```bash
curl -X POST "http://localhost:8000/<APP_NAME>/runners/upload" \
	-H "Authorization: Bearer <TOKEN>" \
	-F "file=@./samples/4540151-hd_1920_1080_30fps.mp4"

# Response contains jobId and s3Url
```

3) Open the socket client in a browser:

- Open `scripts/socketClient.html` in your browser (double-click or serve it), set Server URL to `http://localhost:8000`, paste `jobId`, click Subscribe.

You should see `connected`, periodic `update` messages and then `completed` followed by `disconnected` (auto).

4) Poll for final artifact/result (or use GET result):

```bash
curl "http://localhost:8000/<APP_NAME>/runners/result/<jobId>"
```

5) Retrieve connection history for the job:

```bash
curl "http://localhost:8000/<APP_NAME>/runners/connections/<jobId>"
```

Notes:
- If you don't have a valid JWT for the upload endpoint, you can temporarily bypass auth by setting `verifyToken` to a no-op in `routes/runner.js` for local testing (not recommended for production).
- To simulate a complete processing flow without AssemblyAI, run the simulated processor (mock) that completes quickly:

```bash
npx babel-node ./scripts/simulateJobComplete.js
```


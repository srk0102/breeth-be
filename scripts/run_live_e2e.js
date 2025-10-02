#!/usr/bin/env node
const axios = require('axios')

const { InitializeApp } = require('../app/app')

const SAMPLE_URL = process.env.SAMPLE_URL || 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'
const APP_NAME = process.env.APP_NAME || 'BREETH-CORE'
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || '5000', 10)
const TIMEOUT_MS = parseInt(process.env.TIMEOUT_MS || String(1000 * 60 * 15), 10) // 15 minutes default

async function run() {
  if (!process.env.ASSEMBLYAI_API_KEY) {
    console.error('ASMBLYAI_API_KEY is not set. Set ASSEMBLYAI_API_KEY in env to run live E2E.')
    process.exit(1)
  }

  // Start app programmatically
  const app = await InitializeApp()
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s))
  })
  const port = server.address().port
  const base = `http://localhost:${port}/${APP_NAME}/runners`
  console.log('Server started on port', port)

  try {
    // If the server expects authentication middleware, either set TEST_DISABLE_AUTH=1 or provide a valid token
    console.log('Starting live E2E; uploading link ->', SAMPLE_URL)
    const startResp = await axios.post(`${base}/upload`, { link: SAMPLE_URL, userId: 'live-e2e' }, { timeout: 120000 })
    if (startResp.status !== 200) throw new Error('Upload start failed: ' + startResp.status)
    const jobId = startResp.data.data.jobId
    console.log('Job created:', jobId)

    const startTime = Date.now()
    let final = null
    while (Date.now() - startTime < TIMEOUT_MS) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))
      const res = await axios.get(`${base}/result/${jobId}`, { timeout: 20000 })
      const payload = res.data.data || {}
      console.log('Status poll:', payload.status || 'unknown', 'progress=', payload.progress || '')
      if (payload.transcription) { final = payload; break }
      if (payload.status === 'failed') { throw new Error('Job failed: ' + JSON.stringify(payload)) }
    }

    if (!final) throw new Error('Timed out waiting for transcription')

    console.log('Transcription received (segments):')
    console.log(JSON.stringify(final.transcription, null, 2))
    console.log('Highlights:')
    console.log(JSON.stringify(final.highlights || final.highlights, null, 2))
    console.log('Transcript URL:', final.transcriptUrl)
    console.log('Highlights URL:', final.highlightsUrl)

    return 0
  } catch (err) {
    console.error('Live E2E failed:', err && err.message ? err.message : err)
    return 2
  } finally {
    await new Promise(r => server.close(r))
  }
}

run().then(code => process.exit(code)).catch(e => { console.error(e); process.exit(1) })

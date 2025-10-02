const { expect } = require('chai')
const axios = require('axios')
const sinon = require('sinon')

const { InitializeApp } = require('../../app/app')

// End-to-end polling integration test for AssemblyAI (runs only if ASSEMBLYAI_API_KEY is set)
const APP_NAME = process.env.APP_NAME || 'BREETH-CORE'

describe('AssemblyAI polling E2E', function() {
  this.timeout(1000 * 60 * 12) // 12 minutes
  let server, baseUrl

  beforeEach(async function() {
    // start app on random free port
    const app = await InitializeApp()
    await new Promise((resolve) => {
      server = app.listen(0, () => resolve())
    })
    const port = server.address().port
    baseUrl = `http://localhost:${port}/${APP_NAME}/runners`
  })

  afterEach(async function() {
    if (server && server.close) await new Promise(r => server.close(r))
    sinon.restore()
  })

  it('uploads remote audio and receives transcription via polling', async function() {
    if (!process.env.ASSEMBLYAI_API_KEY) this.skip()

    // small public audio sample
    const sampleUrl = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'

    // start job
    const startResp = await axios.post(`${baseUrl}/upload`, { link: sampleUrl, userId: 'integration-polling' })
    expect(startResp.status).to.equal(200)
    const jobId = startResp.data.data.jobId
    expect(jobId).to.exist

    // poll result until done (up to ~10 minutes)
    let attempts = 0
    let done = false
    let final = null
    while (!done && attempts < 120) {
      await new Promise(r => setTimeout(r, 5000))
      attempts++
      const res = await axios.get(`${baseUrl}/result/${jobId}`)
      const payload = res.data.data || {}
      if (payload.transcription) { done = true; final = payload }
    }

    expect(done).to.equal(true)
    expect(final.transcription).to.exist
  })

  it('CI: polling flow with mocked TranscriptionService (fast)', async function() {
    // CI-friendly: stub TranscriptionService.transcribe to simulate fast processing
    const services = require('../../services')
    const TranscriptionService = services.TranscriptionService

    // ensure TranscriptionService does not early-fail on missing key
    process.env.ASSEMBLYAI_API_KEY = process.env.ASSEMBLYAI_API_KEY || 'test-mock-key'

    const stub = sinon.stub(TranscriptionService, 'transcribe').callsFake(async (s3Url, progressCb) => {
      // simulate progress
      progressCb(30)
      await new Promise(r => setTimeout(r, 50))
      progressCb(100)
      return { duration: 10, segments: [{ speaker: 'Speaker 1', start: 0, end: 10, start_hms: '00:00:00.000', end_hms: '00:00:10.000', text: 'Mock transcription text' }] }
    })

    const sampleUrl = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'
    const startResp = await axios.post(`${baseUrl}/upload`, { link: sampleUrl, userId: 'ci-test' })
    expect(startResp.status).to.equal(200)
    const jobId = startResp.data.data.jobId

    // poll quickly
    let attempts = 0
    let done = false
    let final = null
    while (!done && attempts < 20) {
      await new Promise(r => setTimeout(r, 200))
      attempts++
      const res = await axios.get(`${baseUrl}/result/${jobId}`)
      const payload = res.data.data || {}
      if (payload.transcription) { done = true; final = payload }
    }

    expect(done).to.equal(true)
    expect(final.transcription).to.exist
    expect(final.transcription.segments).to.be.an('array')
  })
})

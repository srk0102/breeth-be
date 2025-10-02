const { expect } = require('chai')
const axios = require('axios')

// This integration test runs only if ASSEMBLYAI_API_KEY is set in env
// It will POST a link to the upload endpoint and poll result until done.

const APP_NAME = process.env.APP_NAME || 'BREETH-CORE'
const BASE = `http://localhost:8080/${APP_NAME}/runners`

describe('AssemblyAI integration (manual/staging)', function() {
  this.timeout(1000 * 60 * 10) // 10 minutes

  it('should process a small public audio file and produce transcript', async function() {
    if (!process.env.ASSEMBLYAI_API_KEY) this.skip()

    // Use a small sample audio file (public)
    const sampleUrl = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'

    // start job
    const startResp = await axios.post(`${BASE}/upload`, { link: sampleUrl, userId: 'integration-test' })
    expect(startResp.status).to.equal(200)
    const jobId = startResp.data.data.jobId
    expect(jobId).to.exist

    // poll result until done
    let attempts = 0
    let done = false
    let final = null
    while (!done && attempts < 120) {
      await new Promise(r => setTimeout(r, 5000))
      attempts++
      const res = await axios.get(`${BASE}/result/${jobId}`)
      if (res.data.data && res.data.data.transcription) { done = true; final = res.data.data }
    }

    expect(done).to.equal(true)
    expect(final.transcription).to.exist
  })
})

const { expect } = require('chai')
const request = require('supertest')
const sinon = require('sinon')

// Load app via babel-register by running npm start in a child process is heavy for tests.
// Instead we'll stub ProcessingService methods directly and call controller handlers.

const { ProcessingService } = require('../services')
const controllers = require('../controllers')

describe('End-to-end flow (unit)', function() {
  it('should create a job and return result after processing', async function() {
    // stub createJob and start and getJob
  const fakeJob = { id: 'job-1', status: 'done', transcription: { segments: [{ speaker: 'Speaker 1', start:0, end:1, start_hms: '00:00:00.000', end_hms: '00:00:01.000', text:'hi' }] }, highlights: [{ start:0, end:1, speaker:'Speaker 1', text:'hi', score:1 }], transcriptUrl: 's3://x/transcript.json', highlightsUrl: 's3://x/highlights.json' }

    const createStub = sinon.stub(ProcessingService, 'createJob').callsFake(() => fakeJob)
    const startStub = sinon.stub(ProcessingService, 'start').callsFake(() => Promise.resolve(fakeJob))
    const getStub = sinon.stub(ProcessingService, 'getJob').callsFake(() => fakeJob)

    // Call controller startProcessing with a fake req/res
    const req = { file: null, body: { s3Url: 'https://bucket/video.mp4' } }
    let status, payload
    const res = {
      status: (s) => { status = s; return res },
      json: (p) => { payload = p; }
    }

    await controllers.startProcessing(req, res)
    expect(status).to.equal(200)
    expect(payload.data.jobId).to.equal(fakeJob.id)

    // call getResult
    const req2 = { params: { jobId: fakeJob.id } }
    let status2, payload2
    const res2 = {
      status: (s) => { status2 = s; return res2 },
      json: (p) => { payload2 = p; }
    }

    await controllers.getResult(req2, res2)
    expect(status2).to.equal(200)
    expect(payload2.data.transcription).to.deep.equal(fakeJob.transcription)
    expect(payload2.data.highlights).to.deep.equal(fakeJob.highlights)

    createStub.restore(); startStub.restore(); getStub.restore();
  })
})

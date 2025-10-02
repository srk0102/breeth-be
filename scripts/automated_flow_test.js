#!/usr/bin/env node
const { InitializeApp } = require('../app/app')
const axios = require('axios')
const ioClient = require('socket.io-client')
const sinon = require('sinon')

const services = require('../services')
const TranscriptionService = services.TranscriptionService

const APP_NAME = process.env.APP_NAME || 'BREETH-CORE'

async function run() {
  // stub transcription to simulate multiple speakers and progress
  const fmt = (ms) => {
    const totalMs = Math.max(0, Math.floor(Number(ms) || 0))
    const hours = Math.floor(totalMs / 3_600_000)
    const minutes = Math.floor((totalMs % 3_600_000) / 60_000)
    const seconds = Math.floor((totalMs % 60_000) / 1000)
    const milliseconds = totalMs % 1000
    const hh = String(hours).padStart(2, '0')
    const mm = String(minutes).padStart(2, '0')
    const ss = String(seconds).padStart(2, '0')
    const mmm = String(milliseconds).padStart(3, '0')
    return `${hh}:${mm}:${ss}.${mmm}`
  }

  const stub = sinon.stub(TranscriptionService, 'transcribe').callsFake(async (s3Url, progressCb) => {
    progressCb(10)
    await new Promise(r => setTimeout(r, 100))
    progressCb(40)
    await new Promise(r => setTimeout(r, 100))
    progressCb(80)
    await new Promise(r => setTimeout(r, 100))
    progressCb(100)
    return {
      duration: 60,
      segments: [
        { speaker: 'Speaker 1', start: 0, end: 10, start_hms: fmt(0), end_hms: fmt(10*1000), text: 'Intro by host' },
        { speaker: 'Speaker 2', start: 10, end: 25, start_hms: fmt(10*1000), end_hms: fmt(25*1000), text: 'Guest responds' },
        { speaker: 'Speaker 1', start: 25, end: 40, start_hms: fmt(25*1000), end_hms: fmt(40*1000), text: 'Follow up' },
        { speaker: 'Speaker 3', start: 40, end: 60, start_hms: fmt(40*1000), end_hms: fmt(60*1000), text: 'Co-host closes' }
      ]
    }
  })

  const app = await InitializeApp()
  const http = require('http')
  const { Server: IOServer } = require('socket.io')
  const ProcessingService = require('../services').ProcessingService

  const server = http.createServer(app)
  const io = new IOServer(server, { cors: { origin: '*' } })

  // replicate server socket handlers (subscribe, recordConnection, finalize, cancel)
  io.on('connection', socket => {
    socket.on('subscribe', ({ jobId }) => {
      const job = ProcessingService.getJob(jobId)
      if (job) socket.emit('update', job)

      const connectedAt = new Date().toISOString()
      const meta = { userAgent: socket.handshake.headers['user-agent'], ip: socket.handshake.address }
      ProcessingService.recordConnection(jobId, socket.id, connectedAt, meta)
      try { socket.emit('connected', { socketId: socket.id, connectedAt, meta }) } catch (e) {}

      const listener = (update) => {
        if (update.id !== jobId) return
        socket.emit('update', update)
        if (['done', 'failed', 'cancelled'].includes(update.status)) {
          try { socket.emit('completed', update) } catch (e) {}
          ProcessingService.off(jobId, listener)
          const disconnectedAt = new Date().toISOString()
          const meta2 = { userAgent: socket.handshake.headers['user-agent'], ip: socket.handshake.address }
          ProcessingService.finalizeConnection(jobId, socket.id, disconnectedAt, meta2)
          try { socket.emit('disconnected', { socketId: socket.id, disconnectedAt, meta: meta2 }) } catch (e) {}
          try { socket.disconnect(true) } catch (e) {}
        }
      }
      ProcessingService.on(jobId, listener)

      socket.on('disconnect', () => {
        ProcessingService.off(jobId, listener)
        const disconnectedAt = new Date().toISOString()
        const meta2 = { userAgent: socket.handshake.headers['user-agent'], ip: socket.handshake.address }
        ProcessingService.finalizeConnection(jobId, socket.id, disconnectedAt, meta2)
        try { socket.emit('disconnected', { socketId: socket.id, disconnectedAt, meta: meta2 }) } catch (e) {}
      })

      socket.on('cancel', async ({ jobId }) => {
        try { await ProcessingService.cancel(jobId); socket.emit('cancelled', { jobId }) } catch (e) { socket.emit('error', { message: e.message }) }
      })
    })
  })

  const listenP = new Promise(resolve => server.listen(0, () => resolve()))
  await listenP
  const port = server.address().port
  const base = `http://localhost:${port}/${APP_NAME}/runners`

  console.log('Test server started on port', port)

  try {
    // start job with remote link (LocalS3Adapter will handle storage)
    const sampleUrl = process.env.SAMPLE_URL || 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'
    const startResp = await axios.post(`${base}/upload`, { link: sampleUrl, userId: 'automated-test' }, { timeout: 120000 })
    if (startResp.status !== 200) throw new Error('Start failed: ' + JSON.stringify(startResp.data))
    const jobId = startResp.data.data.jobId
    console.log('Job started:', jobId)

    // open socket and subscribe
    const socket = ioClient.connect(`http://localhost:${port}`, { transports: ['websocket'] })

    await new Promise((resolve, reject) => {
      let completed = false
      socket.on('connect', () => {
        console.log('Socket connected:', socket.id)
        socket.emit('subscribe', { jobId })
      })

      socket.on('connected', (info) => console.log('Server acknowledged connection', info))
      socket.on('update', (update) => {
        console.log('Update event:', update.status, update.progress || '')
      })
      socket.on('completed', (final) => {
        console.log('Completed event received')
        console.log('Final transcription segments:', JSON.stringify(final.result?.segments || final.transcription?.segments || [], null, 2))
        completed = true
        try { socket.disconnect() } catch (e) {}
        // resolve immediately on completion
        resolve()
      })
      socket.on('disconnected', () => {
        console.log('Socket disconnected')
      })
      socket.on('error', (err) => reject(new Error('Socket error: ' + JSON.stringify(err))))

      // fallback timeout
      setTimeout(() => reject(new Error('Test timed out')), 120000)
    })

    console.log('Test completed successfully')
    stub.restore()
    await new Promise(r => server.close(r))
    process.exit(0)
  } catch (err) {
    console.error('Automated test failed:', err && err.message ? err.message : err)
    try { stub.restore() } catch (e) {}
    await new Promise(r => server.close(r))
    process.exit(1)
  }
}

run()

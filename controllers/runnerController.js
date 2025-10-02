import { Logger, sendResponse } from '../utils'
import { S3Service, ProcessingService } from '../services'
import fs from 'fs'
import path from 'path'
import axios from 'axios'

// POST /upload
export const startProcessing = async (req, res) => {
  try {
    // Accept uploaded file, a direct s3Url, or a link to download
    const bucket = process.env.S3_BUCKET || 'default-bucket'
    let s3Url = ''
    let filedetails = null
    // Use authenticated userId from middleware to prevent spoofing
    const userId = res.locals.userId || req.body?.userId || 'anonymous'

    if (req.body && req.body.link) {
      const remoteUrl = req.body.link
      const originalName = path.basename(remoteUrl.split('?')[0]) || `remote_${Date.now()}`
      const key = `uploads/${userId}/${Date.now()}_${originalName}`
      // use s3Service uploadStreamFromUrl which uses retries
      const uploadResult = await require('../services').S3Service.uploadStreamFromUrl(bucket, key, remoteUrl)
      s3Url = uploadResult.Location
      filedetails = { name: originalName, filetype: uploadResult.ContentType || 'video', size: uploadResult.ContentLength || 0, s3url: s3Url }

    } else if (req.file) {
      const key = `uploads/${userId}/${Date.now()}_${req.file.originalname}`
      const fileBuffer = fs.readFileSync(req.file.path)
      const uploadResult = await S3Service.uploadWithRetries(bucket, key, fileBuffer, req.file.mimetype)
      s3Url = uploadResult.Location
      filedetails = { name: req.file.originalname, filetype: req.file.mimetype, size: fileBuffer.length, s3url: s3Url }

    } else if (req.body && req.body.s3Url) {
      s3Url = req.body.s3Url
      filedetails = { name: path.basename(s3Url.split('?')[0]) || 'file', filetype: 'video', size: 0, s3url: s3Url }

    } else {
      return sendResponse(res, INVALIDREQUEST, '', {}, 'No file, link or s3Url provided')
    }

    const job = ProcessingService.createJob({ s3Url, userId, filedetails })

    // Start async processing
    ProcessingService.start(job.id)

    return sendResponse(res, SUCCESS, 'Processing started', { jobId: job.id, s3Url }, '')
  } catch (err) {
    Logger.error(err)
    return sendResponse(res, INTERNALSERVERERROR, '', {}, 'Failed to start processing')
  }
}

// GET /status/:jobId  (SSE stream)
export const streamStatus = async (req, res) => {
  try {
    const jobId = req.params.jobId
    if (!jobId) return sendResponse(res, INVALIDREQUEST, '', {}, 'Missing jobId')

    // Setup SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    })

    const send = (data) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`)
    }

    // send initial state
    const state = ProcessingService.getJob(jobId)
    if (!state) {
      send({ jobId, error: 'Job not found' })
      return res.end()
    }
    send(state)

    const onUpdate = (update) => {
      if (update.id !== jobId) return
      send(update)
      if (update.status === 'done' || update.status === 'failed') {
        ProcessingService.off(jobId, onUpdate)
        res.end()
      }
    }

    ProcessingService.on(jobId, onUpdate)
    // keep connection alive until closed by client or job completion
  } catch (err) {
    Logger.error(err)
    return sendResponse(res, INTERNALSERVERERROR, '', {}, 'Failed to stream status')
  }
}

// GET /result/:jobId
export const getResult = async (req, res) => {
  try {
    const jobId = req.params.jobId
    const job = ProcessingService.getJob(jobId)
    if (!job) return sendResponse(res, NOTFOUND, '', {}, 'Job not found')
    if (job.status !== 'done') return sendResponse(res, SUCCESS, 'Job in progress', { status: job.status })

    const result = {
      transcription: job.transcription,
      highlights: job.highlights,
      transcriptUrl: job.transcriptUrl,
      highlightsUrl: job.highlightsUrl,
    }

    return sendResponse(res, SUCCESS, 'Job result', result)
  } catch (err) {
    Logger.error(err)
    return sendResponse(res, INTERNALSERVERERROR, '', {}, 'Failed to get result')
  }
}

export default {
  startProcessing,
  streamStatus,
  getResult,
}

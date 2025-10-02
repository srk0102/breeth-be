import { Router } from 'express'

import { ping, startProcessing, streamStatus, getResult } from '../controllers'
import connectionsController from '../controllers/connectionsController'
import { verifyToken } from '../middlewares/jwtVerification'

// import { } from '../validations'

import { asyncWrapper, multerUpload } from '../utils'

export const RunnerRouter = Router()

RunnerRouter.get('/ping', asyncWrapper(ping))

// Upload endpoint: accepts multipart file (field name: file) OR a JSON body with s3Url
// Starts background processing and returns a jobId and s3Url
RunnerRouter.post('/upload', verifyToken, multerUpload.single('file'), asyncWrapper(startProcessing))

// Subscribe to status updates for a jobId using Server-Sent Events
RunnerRouter.get('/status/:jobId', asyncWrapper(streamStatus))

// Fetch final result JSON for a jobId
RunnerRouter.get('/result/:jobId', asyncWrapper(getResult))

// Fetch connection history for a jobId
RunnerRouter.get('/connections/:jobId', asyncWrapper(connectionsController.getConnections))

// Get presigned upload URL for client to upload directly to S3
RunnerRouter.post('/presign', verifyToken, asyncWrapper(async (req, res) => {
	const { key, contentType } = req.body || {}
	if (!key) return res.status(400).json({ error: 'key is required' })
	const bucket = process.env.S3_BUCKET || 'default-bucket'
	try {
		const url = require('../services').S3Service.getPresignedUploadUrl(bucket, key, 3600, contentType)
		return res.json({ url })
	} catch (err) {
		return res.status(500).json({ error: err.message })
	}
}))

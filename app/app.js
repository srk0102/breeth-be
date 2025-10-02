import express, { json } from 'express'
import path from 'path'
import helmet from 'helmet'
import cors from 'cors'
import csrf from 'csurf'
import cookieSession from 'cookie-session'
import cookieParser from 'cookie-parser'
import bodyParser from 'body-parser'

import { FE_URL, APP_NAME, NODE_ENV } from '../config'

import { connectDB } from './database'
import { connectS3 } from './s3'
import { Routes } from '../routes'
import { sendResponse, Logger, logRequest, ASCII_ART } from '../utils'

export const InitializeApp = async () => {

	const app = express()

	// Initialize database and S3 connections
	await connectDB()
	await connectS3()

	// set security HTTP headers
	app.use(helmet())

	app.use(bodyParser.json({ limit: '50mb' }));
	app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

	//middleWares
	app.use(json())

	app.use(cors({
		origin: FE_URL,
		methods: 'GET,POST,PUT,DELETE',
		credentials: true,
	}))

	app.use(cookieParser())

	app.use(
		cookieSession({
			name: 'session',
			keys: [APP_NAME],
			maxAge: 24 * 60 * 60 * 100,
			secure: NODE_ENV === 'prod',
			httpOnly: true,
			signed: true
		})
	)

	NODE_ENV === 'prod' && app.use(csrf({ cookie: true }))

	app.use(logRequest)

	Routes.init(app)

	app.use('/check', (req, res) => {
		return sendResponse(res, SUCCESS, 'App working fine 🤗', {}, '')
	})

	app.get('/', (req, res) => {
		return res.send(`<pre>${ASCII_ART}<pre>`);
	});

	// Serve socket client HTML for convenience
	app.get('/socket-client', (req, res) => {
		const file = path.join(__dirname, '..', 'scripts', 'socketClient.html')
		return res.sendFile(file)
	})

	app.use((req, res) => {
		Logger.error('Page Not Found 🤗')
		return sendResponse(res, NOTFOUND, '', {}, 'Page Not Found 🚫')
	})

	return app
}
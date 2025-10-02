// Set Dynamoose log level to only show warnings and errors
process.env.DYNAMOOSE_LOG_LEVEL = "warn";

import { InitializeApp } from './app'
import { Logger } from './utils'
import { PORT, NODE_ENV } from './config'
import http from 'http'
import { Server as IOServer } from 'socket.io'
import { ProcessingService } from './services'

let io

export const getIO = () => io

//Initialize server
(async () => {
	try {
		const app = await InitializeApp()
		const server = http.createServer(app)
		io = new IOServer(server, { cors: { origin: '*' } })

		// Socket connection handling
		io.on('connection', socket => {
			Logger.info('Socket connected', socket.id)

			socket.on('subscribe', ({ jobId }) => {
				// on subscription, send current state and register
				const job = ProcessingService.getJob(jobId)
				if (job) socket.emit('update', job)

				// record connection timestamp + metadata
				const connectedAt = new Date().toISOString()
				const meta = { userAgent: socket.handshake.headers['user-agent'], ip: socket.handshake.address }
				const conn = ProcessingService.recordConnection(jobId, socket.id, connectedAt, meta)
				try { socket.emit('connected', { socketId: socket.id, connectedAt, meta }) } catch (e) {}
				const listener = (update) => {
					if (update.id !== jobId) return
					socket.emit('update', update)
					// when job reaches a terminal state, notify and close socket
					if (['done', 'failed', 'cancelled'].includes(update.status)) {
						try {
							socket.emit('completed', update)
						} catch (e) { /* ignore */ }
						// remove listener and disconnect this socket
						ProcessingService.off(jobId, listener)
						// finalize connection record with disconnect timestamp
						const disconnectedAt = new Date().toISOString()
						const meta2 = { userAgent: socket.handshake.headers['user-agent'], ip: socket.handshake.address }
						ProcessingService.finalizeConnection(jobId, socket.id, disconnectedAt, meta2)
						try { socket.emit('disconnected', { socketId: socket.id, disconnectedAt, meta: meta2 }) } catch (e) {}
						try { socket.disconnect(true) } catch (e) { /* ignore */ }
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

		server.listen(PORT, () => {
			Logger.success(`Server Running on ${PORT}, environment: ${NODE_ENV}`)
		})
	}
	catch (err) {
		Logger.error('Bootstrap server error' + err.message)
		throw (err)
	}
})()
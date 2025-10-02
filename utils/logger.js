import dayjs from 'dayjs'

export const getCurrentTimestamp = () => {
	const timestamp = dayjs()
	return `[${timestamp}]`
}

export const Logger = {
	info: (...message) => {
		console.log(`\x1b[34m[INFO]\x1b[0m TimeStamp: ${getCurrentTimestamp()}, Message: ${message}`)
	},
	success: (...message) => {
		console.log(`\x1b[32m[SUCCESS]\x1b[0m TimeStamp: ${getCurrentTimestamp()}, Message: ${message}`)
	},
	warning: (...message) => {
		console.log(`\x1b[33m[WARNING]\x1b[0m TimeStamp: ${getCurrentTimestamp()}, Message: ${message}`)
	},
	error: (...message) => {
		console.log(`\x1b[31m[ERROR]\x1b[0m TimeStamp: ${getCurrentTimestamp()}, Message: ${message}`)
	}
}

export const logRequest = (req, res, next) => {
	const method = req.method
	const url = req.originalUrl

	const startHrTime = process.hrtime.bigint()

	res.on('finish', () => {
		const statusCode = res.statusCode
		const statusText = res.statusMessage

		const endHrTime = process.hrtime.bigint()
		const elapsedTimeInMs = Number(endHrTime - startHrTime)/1000000

		// Log whether the request passed or failed
		if (statusCode >= 200 && statusCode < 400) {
			console.log(`\x1b[32m[SUCCESS]\x1b[0m ${method} ${url} ~${elapsedTimeInMs}ms -> (${statusCode} ${statusText})`)
		} else {
			console.log(`\x1b[31m[ERROR]\x1b[0m ${method} ${url} ~${elapsedTimeInMs}ms -> (${statusCode} ${statusText})`)
		}
	})

	next()
}
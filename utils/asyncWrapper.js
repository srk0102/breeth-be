import { sendResponse, Logger } from '../utils'

export const asyncWrapper = (fn) => async (req, res, next) => {
	const functionName = fn.name
	try {
		return await fn.call(this, req, res, next, functionName)
	}
	catch (error) {
		Logger.error([`AsyncWrapper: ${error.message}`, req.headers])
		sendResponse(res, INTERNALSERVERERROR, '', {}, 'Oops! Something went wrong')
		next(error)
	}
}
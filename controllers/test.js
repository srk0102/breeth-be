import { Logger, sendResponse } from '../utils'

export const ping = (req, res) => {
	try {
		return sendResponse(res, SUCCESS, 'pong')
	}
	catch (err) {
		return sendResponse(res, INTERNALSERVERERROR, '', {}, 'Internal server error')
	}
}

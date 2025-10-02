import { ProcessingService } from '../services'
import { sendResponse, Logger } from '../utils'
import { SUCCESS, NOTFOUND, INVALIDREQUEST, INTERNALSERVERERROR } from '../constants'

export const getConnections = async (req, res) => {
  try {
    const jobId = req.params.jobId
    if (!jobId) return sendResponse(res, INVALIDREQUEST, '', {}, 'Missing jobId')
    const job = ProcessingService.getJob(jobId)
    if (!job) return sendResponse(res, NOTFOUND, '', {}, 'Job not found')
    const connections = job.connectionLog || []
    return sendResponse(res, SUCCESS, 'Connections', { connections })
  } catch (err) {
    Logger.error(err)
    return sendResponse(res, INTERNALSERVERERROR, '', {}, 'Failed to fetch connections')
  }
}

export default { getConnections }

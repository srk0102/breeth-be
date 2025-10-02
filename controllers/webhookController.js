import { ProcessingService } from '../services'
import { Logger } from '../utils'

// AssemblyAI webhook handler
export const assemblyai = async (req, res) => {
  try {
    const payload = req.body
    // Basic validation
    if (!payload || !payload.id) {
      Logger.warn('Received invalid AssemblyAI webhook payload')
      return res.status(400).send('invalid payload')
    }

    // Only act on completed transcripts
    if (payload.status && payload.status !== 'completed') {
      Logger.info(`Ignoring assemblyai webhook status=${payload.status} for id=${payload.id}`)
      return res.status(204).send()
    }

    await ProcessingService.completeFromAssembly(payload)

    res.status(200).send('ok')
  } catch (err) {
    Logger.error('Error handling assemblyai webhook', err)
    res.status(500).send('error')
  }
}

import { Logger, formatTimeMs } from '../utils'
import axios from 'axios'

const ASSEMBLY_KEY = process.env.ASSEMBLYAI_API_KEY
const OPENAI_KEY = process.env.OPENAI_API_KEY

const assemblyHeaders = () => ({
  Authorization: `Bearer ${ASSEMBLY_KEY}`,
  'Content-Type': 'application/json'
})

export const TranscriptionService = {
  normalizeTranscript: (transcription) => {
    if (!transcription) return { duration: 0, segments: [] }
    const result = { duration: transcription.audio_duration || null, segments: [] }
    if (Array.isArray(transcription.utterances) && transcription.utterances.length) {
      result.segments = transcription.utterances.map(u => {
        const startMs = Math.round((u.start || 0))
        const endMs = Math.round((u.end || 0))
        const startSec = startMs / 1000.0
        const endSec = endMs / 1000.0
        return {
          speaker: `Speaker ${u.speaker}`,
          start: startSec,
          end: endSec,
          start_hms: formatTimeMs(startMs),
          end_hms: formatTimeMs(endMs),
          text: u.text
        }
      })
    } else if (Array.isArray(transcription.words) && transcription.words.length) {
      result.segments = transcription.words.slice(0, 1000).map(w => {
        const startMs = Math.round((w.start || 0))
        const endMs = Math.round((w.end || 0))
        return {
          speaker: w.speaker || 'Speaker 1',
          start: startMs / 1000.0,
          end: endMs / 1000.0,
          start_hms: formatTimeMs(startMs),
          end_hms: formatTimeMs(endMs),
          text: w.text
        }
      })
    } else {
  const startMs = 0
  const endMs = result.duration ? Math.round((result.duration || 0) * 1000) : 0
  result.segments = [{ speaker: 'Speaker 1', start: 0, end: result.duration || 0, start_hms: formatTimeMs(startMs), end_hms: formatTimeMs(endMs), text: transcription.text || '' }]
    }
    return result
  },
  transcribe: async (s3Url, progressCb = () => {}) => {
  if (!ASSEMBLY_KEY) throw new Error('ASSEMBLYAI_API_KEY not set')

    Logger.info('Submitting transcription job to AssemblyAI for', s3Url)

    // Create transcript (polling mode)
    const createBody = {
      audio_url: s3Url,
      speaker_labels: true,
      auto_chapters: false
    }

    const createResp = await axios.post('https://api.assemblyai.com/v2/transcript', createBody, { headers: assemblyHeaders() })
    const id = createResp.data.id

    // Polling loop with exponential backoff and limited retries
    const sleep = (ms) => new Promise(r => setTimeout(r, ms))
    let attempt = 0
    let delay = 2000
    let transcription = null
    while (true) {
      attempt += 1
      try {
        await sleep(delay)
        const statusResp = await axios.get(`https://api.assemblyai.com/v2/transcript/${id}`, { headers: assemblyHeaders() })
        const data = statusResp.data
        if (data.status === 'completed') {
          transcription = data
          progressCb(100)
          break
        }
        if (data.status === 'error') {
          throw new Error(`AssemblyAI error: ${data.error}`)
        }

        // best-effort progress: use audio_duration and polling attempts
        const estimate = data.audio_duration ? Math.min(95, Math.floor((attempt * delay) / (data.audio_duration * 10) + 20)) : Math.min(95, 10 + attempt * 5)
        progressCb(estimate)

        // backoff growth
        delay = Math.min(15000, delay * 1.5)
        // continue polling
      } catch (err) {
        Logger.error('Polling error', err.message)
        if (attempt >= 20) throw new Error('Transcription polling failed after multiple attempts')
        // small backoff and retry
        delay = Math.min(15000, delay * 1.5)
      }
    }

  // Normalize and return
  return TranscriptionService.normalizeTranscript(transcription)
  },

  extractHighlights: async (transcription, topN = 3) => {
    // If OPENAI is available, ask it to rank segments and return topN
    const segments = transcription.segments || []
    if (OPENAI_KEY && segments.length > 0) {
      try {
        const prompt = `You are given a list of transcript segments with speaker, start, end and text. Return the top ${topN} most important/highlight moments as a JSON array of objects with fields: start, end, speaker, text, score (0-1). Input: ${JSON.stringify(segments.slice(0, 30))}`

        const resp = await axios.post('https://api.openai.com/v1/chat/completions', {
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 800,
          temperature: 0.2
        }, { headers: { Authorization: `Bearer ${OPENAI_KEY}` } })

        const content = resp.data.choices?.[0]?.message?.content || ''
        // try to parse JSON from content
        const jsonStart = content.indexOf('[')
        const json = jsonStart >= 0 ? content.slice(jsonStart) : content
        const parsed = JSON.parse(json)
        return parsed
      } catch (err) {
        Logger.error('OpenAI ranking failed, falling back to heuristic', err.message)
      }
    }

    // Heuristic fallback: top N segments by word count
    const scored = segments.map(s => ({ ...s, score: (s.text || '').split(/\s+/).length }))
    scored.sort((a,b)=>b.score-a.score)
    return scored.slice(0, topN).map(s => ({ start: s.start, end: s.end, speaker: s.speaker, text: s.text, score: s.score }))
  }
}

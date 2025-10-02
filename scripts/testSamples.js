import path from 'path'
import fs from 'fs'
import os from 'os'
import { connectS3 } from '../app/s3'
import { S3Service } from '../services'
import { Logger } from '../utils'
import ytdl from 'ytdl-core'
import playdl from 'play-dl'
import { execFile } from 'child_process'
import { promisify } from 'util'
const execFileP = promisify(execFile)

const bucket = process.env.S3_BUCKET || 'local-bucket'

const run = async () => {
  try {
    // If requested, force local S3 adapter by clearing AWS creds in this process
    if (process.env.USE_LOCAL_S3 === '1') {
      process.env.AWS_ACCESS_KEY_ID = ''
      process.env.AWS_SECRET_ACCESS_KEY = ''
      console.log('Forcing LocalS3Adapter via USE_LOCAL_S3=1')
    }
    await connectS3()

    // Upload local sample
    const sampleDir = path.join(__dirname, '..', 'samples')
    const files = fs.readdirSync(sampleDir).filter(f => f.endsWith('.mp4'))
    if (!files.length) throw new Error('No sample mp4 files found in samples/')
    const samplePath = path.join(sampleDir, files[0])
    const keyLocal = `test/uploads/local_${Date.now()}_${files[0]}`
    const buf = fs.readFileSync(samplePath)
    const resLocal = await S3Service.uploadWithRetries(bucket, keyLocal, buf, 'video/mp4')
    Logger.info('Local sample uploaded:', resLocal)

    // Download YouTube link and upload
    const yt = 'https://youtu.be/qFYJnqrn8DY?si=anm7C6CbJqC9jFX5'
    const requestOptions = { headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36' } }
    let tmpFile = path.join(os.tmpdir(), `yt_${Date.now()}.mp4`)
    let keyYT = `test/uploads/yt_${Date.now()}.mp4`
    // normalize YouTube url (convert youtu.be short links to full watch URL)
    const normalizeYoutube = (u) => {
      try {
        const parsed = new URL(u)
        if (parsed.hostname === 'youtu.be') {
          const id = parsed.pathname.replace('/', '')
          return `https://www.youtube.com/watch?v=${id}`
        }
        // remove 'si' or other ephemeral params that may confuse extractors
        if (parsed.hostname.includes('youtube')) {
          const id = parsed.searchParams.get('v')
          if (id) return `https://www.youtube.com/watch?v=${id}`
        }
        return u
      } catch (e) {
        return u
      }
    }
    const normalizedYt = normalizeYoutube(yt)
    try {
      const info = await ytdl.getInfo(normalizedYt, { requestOptions })
      Logger.info('YouTube title:', info.videoDetails.title)
      keyYT = `test/uploads/yt_${Date.now()}_${info.videoDetails.videoId}.mp4`

      // stream to temp file then upload
      tmpFile = path.join(os.tmpdir(), `yt_${Date.now()}.mp4`)
      const out = fs.createWriteStream(tmpFile)
      await new Promise((resolve, reject) => {
        ytdl(normalizedYt, { quality: 'highestvideo', requestOptions })
          .pipe(out)
          .on('finish', resolve)
          .on('error', reject)
      })
    } catch (ytdlErr) {
      Logger.warning('ytdl-core failed, falling back to play-dl:', ytdlErr.message)
      tmpFile = path.join(os.tmpdir(), `yt_${Date.now()}.mp4`)
      try {
        const stream = await playdl.stream(normalizedYt)
        await new Promise((resolve, reject) => {
          const out = fs.createWriteStream(tmpFile)
          stream.stream.pipe(out)
          out.on('finish', resolve)
          out.on('error', reject)
        })
      } catch (pdErr) {
        Logger.warning('play-dl also failed:', pdErr && pdErr.message ? pdErr.message : pdErr)
        // Fallback to system yt-dlp if available
        try {
          Logger.info('Attempting system yt-dlp fallback')
          // yt-dlp -f best -o tmpFile url
          await execFileP('yt-dlp', ['-f', 'best', '-o', tmpFile, normalizedYt])
        } catch (ytDpErr) {
          throw new Error(`play-dl failed and yt-dlp fallback failed: ${ytDpErr.message || ytDpErr}. Install yt-dlp or provide a direct mp4 URL.`)
        }
      }
    }
    const buf2 = fs.readFileSync(tmpFile)
    const resYT = await S3Service.uploadWithRetries(bucket, keyYT, buf2, 'video/mp4')
    Logger.info('YouTube sample uploaded:', resYT)

    // cleanup temp
    try { fs.unlinkSync(tmpFile) } catch (e) {}

    console.log('Done')
  } catch (err) {
    console.error('TestSamples failed:', err.stack || err.message || err)
    process.exit(1)
  }
}

run()

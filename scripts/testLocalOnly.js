import path from 'path'
import fs from 'fs'
import { connectS3 } from '../app/s3'
import { S3Service } from '../services'
import { Logger } from '../utils'

const bucket = process.env.S3_BUCKET || 'local-bucket'

const run = async () => {
  try {
    // force local S3 adapter for this quick test
    process.env.AWS_ACCESS_KEY_ID = ''
    process.env.AWS_SECRET_ACCESS_KEY = ''
    await connectS3()

    const sampleDir = path.join(__dirname, '..', 'samples')
    const files = fs.readdirSync(sampleDir).filter(f => f.endsWith('.mp4'))
    if (!files.length) throw new Error('No sample mp4 files found in samples/')
    const samplePath = path.join(sampleDir, files[0])
    const key = `test/local_only_${Date.now()}_${files[0]}`
    const buf = fs.readFileSync(samplePath)

    const res = await S3Service.uploadWithRetries(bucket, key, buf, 'video/mp4')
    Logger.info('Local-only sample uploaded:', res)
    console.log('\nUpload result:', res)
    process.exit(0)
  } catch (err) {
    console.error('testLocalOnly failed:', err.stack || err.message || err)
    process.exit(1)
  }
}

run()

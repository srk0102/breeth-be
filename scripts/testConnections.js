import { ProcessingService } from '../services'
import { connectS3 } from '../app/s3'

const run = async () => {
  await connectS3()
  const job = ProcessingService.createJob({ s3Url: 'file://tmp/test.mp4', userId: 'u1', filedetails: { name: 't', filetype: 'video', size: 123, s3url: 'file://tmp/test.mp4' } })
  console.log('created job', job.id)
  const connectedAt = new Date().toISOString()
  const rec = ProcessingService.recordConnection(job.id, 'socket-1', connectedAt)
  console.log('recorded', rec)
  const disconnectedAt = new Date().toISOString()
  const fin = ProcessingService.finalizeConnection(job.id, 'socket-1', disconnectedAt)
  console.log('finalized', fin)
}

run().catch(e => { console.error(e); process.exit(1) })

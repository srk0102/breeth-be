/*
  Simple S3 connectivity tester.
  - Loads .env
  - Uses AWS credentials from env
  - Calls headBucket on S3_BUCKET
  Outputs a short success/failure message.
*/

const dotenv = require('dotenv')
dotenv.config()

const AWS = require('aws-sdk')

const {
  AWS_REGION,
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  S3_BUCKET,
} = process.env

if (!S3_BUCKET) {
  console.error('S3_BUCKET is not set in .env')
  process.exit(2)
}

if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !AWS_REGION) {
  console.error('AWS credentials or region missing in .env')
  process.exit(2)
}

const s3 = new AWS.S3({
  region: AWS_REGION,
  accessKeyId: AWS_ACCESS_KEY_ID,
  secretAccessKey: AWS_SECRET_ACCESS_KEY,
})

;(async function () {
  try {
    await s3.headBucket({ Bucket: S3_BUCKET }).promise()
    console.log('S3 connection: OK — bucket exists and is reachable')
    process.exit(0)
  } catch (err) {
    console.error('S3 connection: FAILED')
    if (err && err.code) console.error('Error code:', err.code)
    if (err && err.statusCode) console.error('HTTP status:', err.statusCode)

    // Attempt to list accessible buckets to help diagnose permissions
    try {
      const list = await s3.listBuckets().promise()
      const names = (list.Buckets || []).map(b => b.Name)
      console.log('Accessible buckets for these credentials:')
      names.forEach(n => console.log(' -', n))
    } catch (listErr) {
      console.error('Unable to list buckets. You likely lack s3:ListAllMyBuckets permission.')
      if (listErr && listErr.code) console.error('List error code:', listErr.code)
    }

    process.exit(1)
  }
})()

// s3.js - Connection only
// Using AWS SDK v3 when available
import { S3Client, ListBucketsCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { PutObjectCommand, GetObjectCommand, HeadObjectCommand, DeleteObjectCommand, ListObjectsV2Command, CopyObjectCommand, DeleteObjectsCommand } from '@aws-sdk/client-s3'
import fs from 'fs'
import path from 'path'
const { Logger } = require('../utils');

import {
  AWS_REGION,
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
} from "../config";

let s3Instance = null;

// Local filesystem based S3 adapter (minimal subset used by the services)
class LocalS3Adapter {
  constructor(baseDir) {
    this.baseDir = baseDir
    if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true })
  }

  // mimic s3.upload(params).promise()
  upload(params) {
    const { Bucket, Key, Body } = params
    const filePath = path.join(this.baseDir, Key)
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(filePath, Body)
    const location = `file://${filePath}`
    return { promise: async () => ({ Location: location, Bucket, Key }) }
  }

  // getSignedUrl used synchronously in code
  getSignedUrl(operation, params) {
    const { Bucket, Key } = params
    const filePath = path.join(this.baseDir, Key)
    return `file://${filePath}`
  }

  // getObject(params).promise()
  getObject(params) {
    const { Bucket, Key } = params
    const filePath = path.join(this.baseDir, Key)
    return { promise: async () => {
      if (!fs.existsSync(filePath)) throw Object.assign(new Error('NotFound'), { code: 'NotFound' })
      const Body = fs.readFileSync(filePath)
      return { Body }
    }}
  }

  headObject(params) {
    const { Key } = params
    const filePath = path.join(this.baseDir, Key)
    return { promise: async () => {
      if (!fs.existsSync(filePath)) {
        const err = new Error('NotFound')
        err.code = 'NotFound'
        throw err
      }
      const stats = fs.statSync(filePath)
      return { ContentLength: stats.size }
    }}
  }

  deleteObject(params) {
    const { Key } = params
    const filePath = path.join(this.baseDir, Key)
    return { promise: async () => {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
      return {}
    }}
  }

  deleteObjects(params) {
    const keys = (params.Delete && params.Delete.Objects) || []
    const Deleted = []
    keys.forEach(k => {
      const filePath = path.join(this.baseDir, k.Key)
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath)
        Deleted.push({ Key: k.Key })
      }
    })
    return { promise: async () => ({ Deleted }) }
  }

  listObjectsV2(params) {
    const prefix = params.Prefix || ''
    const dir = path.join(this.baseDir, prefix)
    const Contents = []
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir)
      files.forEach(f => {
        const full = path.join(dir, f)
        const stats = fs.statSync(full)
        if (stats.isFile()) Contents.push({ Key: path.join(prefix, f), Size: stats.size })
      })
    }
    return { promise: async () => ({ Contents }) }
  }

  copyObject(params) {
    const { CopySource, Bucket, Key } = params
    // CopySource format expected: "sourceBucket/sourceKey"
    const [, sourceKey] = CopySource.split('/')
    const src = path.join(this.baseDir, sourceKey)
    const dst = path.join(this.baseDir, Key)
    const dir = path.dirname(dst)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    if (!fs.existsSync(src)) {
      const err = new Error('NotFound')
      err.code = 'NotFound'
      return { promise: async () => { throw err } }
    }
    fs.copyFileSync(src, dst)
    return { promise: async () => ({}) }
  }

  listBuckets() {
    // local adapter doesn't have buckets; return empty list
    return { promise: async () => ({ Buckets: [] }) }
  }
}

export const connectS3 = async () => {
  try {
    // If requested, force local adapter for testing
    if (process.env.USE_LOCAL_S3 === '1') {
      const localDir = path.join(__dirname, '..', 'utils', 'uploads')
      s3Instance = new LocalS3Adapter(localDir)
      Logger.info('Forced LocalS3Adapter via USE_LOCAL_S3=1')
      return s3Instance
    }

    // If AWS creds present, use real S3; else fallback to local adapter
      if (AWS_ACCESS_KEY_ID && AWS_SECRET_ACCESS_KEY) {
        const s3Config = {
          region: AWS_REGION,
          credentials: { accessKeyId: AWS_ACCESS_KEY_ID, secretAccessKey: AWS_SECRET_ACCESS_KEY }
        }
        const client = new S3Client(s3Config)
        // wrap a minimal adapter that exposes .upload(params).promise() and getSignedUrl compatibility
        s3Instance = {
          __client: client,
          async upload(params, options) {
            // use @aws-sdk/lib-storage Upload for managed multipart
            const { Upload } = await import('@aws-sdk/lib-storage')
            const upload = new Upload({ client, params, leavePartsOnError: false, queueSize: (options && options.queueSize) || 4, partSize: (options && options.partSize) || 10 * 1024 * 1024 })
            const res = await upload.done()
            // Upload.done() returns no Location; construct a URL-like location
            return { Location: `s3://${params.Bucket}/${params.Key}`, Bucket: params.Bucket, Key: params.Key }
          },
          getSignedUrl: (operation, params) => {
            // operation 'getObject' or 'putObject'
            if (operation === 'getObject') {
              const cmd = new GetObjectCommand({ Bucket: params.Bucket, Key: params.Key })
              return getSignedUrl(client, cmd, { expiresIn: params.Expires || 3600 })
            }
            if (operation === 'putObject') {
              const cmd = new PutObjectCommand({ Bucket: params.Bucket, Key: params.Key, ContentType: params.ContentType })
              return getSignedUrl(client, cmd, { expiresIn: params.Expires || 3600 })
            }
            throw new Error('Unsupported operation for getSignedUrl')
          },
          async getObject(params) { const res = await client.send(new GetObjectCommand({ Bucket: params.Bucket, Key: params.Key })); return { promise: async () => res } },
          async headObject(params) { const res = await client.send(new HeadObjectCommand({ Bucket: params.Bucket, Key: params.Key })); return { promise: async () => res } },
          async deleteObject(params) { await client.send(new DeleteObjectCommand({ Bucket: params.Bucket, Key: params.Key })); return { promise: async () => ({}) } },
          async deleteObjects(params) { await client.send(new DeleteObjectsCommand({ Bucket: params.Bucket, Delete: params.Delete })); return { promise: async () => ({}) } },
          async listObjectsV2(params) { const res = await client.send(new ListObjectsV2Command({ Bucket: params.Bucket, Prefix: params.Prefix, MaxKeys: params.MaxKeys })); return { promise: async () => res } },
          async copyObject(params) { await client.send(new CopyObjectCommand({ Bucket: params.Bucket, CopySource: params.CopySource, Key: params.Key })); return { promise: async () => ({}) } },
          async listBuckets() { const res = await client.send(new ListBucketsCommand({})); return { promise: async () => res } }
        }
        try {
          await s3Instance.listBuckets().promise()
          Logger.success(`Connected to AWS S3 successfully in region: ${AWS_REGION}`)
          // verify configured bucket exists if provided
          const targetBucket = process.env.S3_BUCKET
          if (targetBucket) {
            try {
              // try a headObject on a non-existent key to verify bucket exists via listObjects
              await client.send(new ListObjectsV2Command({ Bucket: targetBucket, MaxKeys: 1 }))
            } catch (bucketErr) {
              Logger.warning(`Configured S3_BUCKET '${targetBucket}' not accessible: ${bucketErr.message}. Falling back to LocalS3Adapter`)
              const localDir = path.join(__dirname, '..', 'utils', 'uploads')
              s3Instance = new LocalS3Adapter(localDir)
              return s3Instance
            }
          }
        } catch (testError) {
          Logger.warning('S3 connection configured but unable to test (may be due to permissions) — falling back to LocalS3Adapter')
          const localDir = path.join(__dirname, '..', 'utils', 'uploads')
          s3Instance = new LocalS3Adapter(localDir)
          return s3Instance
        }
    } else {
      const localDir = path.join(__dirname, '..', 'utils', 'uploads')
      s3Instance = new LocalS3Adapter(localDir)
      Logger.info('Using LocalS3Adapter for S3 operations (no AWS credentials found)')
    }
    return s3Instance
  } catch (error) {
    Logger.error('S3 connection error:', error)
    throw error
  }
}

// Get the S3 instance
export const getS3 = () => {
  if (!s3Instance) {
    throw new Error('S3 not initialized. Call connectS3() first.');
  }
  return s3Instance;
};

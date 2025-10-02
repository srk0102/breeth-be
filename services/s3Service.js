// s3Service.js - All S3 operations
import { getS3 } from '../app/s3';
const { Logger } = require('../utils');
import axios from 'axios'

const isStream = (obj) => obj && typeof obj.pipe === 'function'

export const S3Service = {
  // Upload file to S3
  uploadFile: async (bucketName, key, fileBuffer, contentType = 'application/octet-stream') => {
    try {
      const s3 = getS3();
      const params = {
        Bucket: bucketName,
        Key: key,
        Body: fileBuffer,
        ContentType: contentType,
      };

      // default managed upload (supports multipart)
      const uploader = s3.upload ? s3.upload(params) : null
      let result
      if (uploader && typeof uploader.promise === 'function') {
        result = await uploader.promise()
      } else if (uploader && typeof uploader.then === 'function') {
        result = await uploader
      } else if (uploader && uploader.Location) {
        result = uploader
      } else {
        // fallback: if using v3 wrapper we exposed above
        result = await s3.upload(params, {})
      }
      Logger.info(`File uploaded successfully: ${result.Location || `s3://${params.Bucket}/${params.Key}`}`);
      return result;
    } catch (error) {
      Logger.error('S3 upload error:', error);
      throw error;
    }
  },

  // Upload with retries and tuned multipart options. Accepts Buffer or stream factory.
  uploadWithRetries: async (bucketName, key, bodyOrFactory, contentType = 'application/octet-stream', maxRetries = 4) => {
    const s3 = getS3();

    const uploadOnce = async (body) => {
      const params = { Bucket: bucketName, Key: key, Body: body, ContentType: contentType }
      // tune partSize (10MB) and queueSize for multipart upload
      if (s3.upload && typeof s3.upload === 'function') {
        const up = s3.upload(params, { partSize: 10 * 1024 * 1024, queueSize: 4 })
        if (up && typeof up.promise === 'function') return up.promise()
        if (up && typeof up.then === 'function') return up
        if (up && up.Location) return up
      }
      // v3 wrapper path
      return s3.upload(params, { partSize: 10 * 1024 * 1024, queueSize: 4 })
    }

    let attempt = 0
    let lastErr
    while (attempt <= maxRetries) {
      try {
        attempt++
        const body = typeof bodyOrFactory === 'function' ? await bodyOrFactory() : bodyOrFactory
        const res = await uploadOnce(body)
        Logger.info(`S3 upload success (attempt ${attempt}): ${res.Location}`)
        return res
      } catch (err) {
        lastErr = err
        Logger.error(`S3 upload attempt ${attempt} failed: ${err.message || err}`)
        if (attempt > maxRetries) break
        // exponential backoff
        const backoff = Math.min(30000, 500 * Math.pow(2, attempt))
        await new Promise(r => setTimeout(r, backoff))
      }
    }

    Logger.error('S3 upload failed after retries', lastErr)
    throw lastErr
  },

  // Download remote URL and upload to S3 with retries. bodyFactory recreates the stream each attempt.
  uploadStreamFromUrl: async (bucketName, key, url, contentType = 'application/octet-stream', maxRetries = 4) => {
    try {
      const resp = await axios({ method: 'get', url, responseType: 'arraybuffer' })
      const buffer = Buffer.from(resp.data)
      // reuse uploadFile path
      const s3 = getS3()
      const params = { Bucket: bucketName, Key: key, Body: buffer, ContentType: contentType }
      const uploader = s3.upload ? s3.upload(params, { partSize: 10 * 1024 * 1024, queueSize: 4 }) : null
      let result
      if (uploader && typeof uploader.promise === 'function') result = await uploader.promise()
      else if (uploader && typeof uploader.then === 'function') result = await uploader
      else if (uploader && uploader.Location) result = uploader
      else result = await s3.upload(params, {})
      return result
    } catch (err) {
      Logger.error('uploadStreamFromUrl failed', err)
      throw err
    }
  },

  // Download file from S3
  downloadFile: async (bucketName, key) => {
    try {
      const s3 = getS3();
      const params = {
        Bucket: bucketName,
        Key: key,
      };

      const result = await s3.getObject(params).promise();
      Logger.info(`File downloaded successfully: ${key}`);
      return result;
    } catch (error) {
      Logger.error('S3 download error:', error);
      throw error;
    }
  },

  // Generate presigned URL for file access
  getPresignedUrl: (bucketName, key, expiresIn = 3600) => {
    try {
      const s3 = getS3();
      const params = {
        Bucket: bucketName,
        Key: key,
        Expires: expiresIn, // URL expires in seconds (default: 1 hour)
      };

      const url = s3.getSignedUrl('getObject', params);
      Logger.info(`Presigned URL generated for: ${key}`);
      return url;
    } catch (error) {
      Logger.error('S3 presigned URL error:', error);
      throw error;
    }
  },

  // Generate presigned URL for file upload
  getPresignedUploadUrl: (bucketName, key, expiresIn = 3600, contentType = 'application/octet-stream') => {
    try {
      const s3 = getS3();
      const params = {
        Bucket: bucketName,
        Key: key,
        Expires: expiresIn,
        ContentType: contentType,
      };

      const url = s3.getSignedUrl('putObject', params);
      Logger.info(`Presigned upload URL generated for: ${key}`);
      return url;
    } catch (error) {
      Logger.error('S3 presigned upload URL error:', error);
      throw error;
    }
  },

  // Delete file from S3
  deleteFile: async (bucketName, key) => {
    try {
      const s3 = getS3();
      const params = {
        Bucket: bucketName,
        Key: key,
      };

      const result = await s3.deleteObject(params).promise();
      Logger.info(`File deleted successfully: ${key}`);
      return result;
    } catch (error) {
      Logger.error('S3 delete error:', error);
      throw error;
    }
  },

  // Delete multiple files from S3
  deleteFiles: async (bucketName, keys) => {
    try {
      const s3 = getS3();
      const params = {
        Bucket: bucketName,
        Delete: {
          Objects: keys.map(key => ({ Key: key })),
          Quiet: false
        }
      };

      const result = await s3.deleteObjects(params).promise();
      Logger.info(`${result.Deleted?.length || 0} files deleted successfully`);
      return result;
    } catch (error) {
      Logger.error('S3 bulk delete error:', error);
      throw error;
    }
  },

  // List files in S3 bucket
  listFiles: async (bucketName, prefix = '', maxKeys = 1000) => {
    try {
      const s3 = getS3();
      const params = {
        Bucket: bucketName,
        Prefix: prefix,
        MaxKeys: maxKeys,
      };

      const result = await s3.listObjectsV2(params).promise();
      Logger.info(`Listed ${result.Contents?.length || 0} files from bucket: ${bucketName}`);
      return result;
    } catch (error) {
      Logger.error('S3 list files error:', error);
      throw error;
    }
  },

  // Check if file exists in S3
  fileExists: async (bucketName, key) => {
    try {
      const s3 = getS3();
      const params = {
        Bucket: bucketName,
        Key: key,
      };

      await s3.headObject(params).promise();
      return true;
    } catch (error) {
      if (error.code === 'NotFound') {
        return false;
      }
      Logger.error('S3 file exists check error:', error);
      throw error;
    }
  },

  // Get file metadata
  getFileMetadata: async (bucketName, key) => {
    try {
      const s3 = getS3();
      const params = {
        Bucket: bucketName,
        Key: key,
      };

      const result = await s3.headObject(params).promise();
      Logger.info(`File metadata retrieved for: ${key}`);
      return result;
    } catch (error) {
      Logger.error('S3 get metadata error:', error);
      throw error;
    }
  },

  // Copy file within S3
  copyFile: async (sourceBucket, sourceKey, destinationBucket, destinationKey) => {
    try {
      const s3 = getS3();
      const params = {
        Bucket: destinationBucket,
        CopySource: `${sourceBucket}/${sourceKey}`,
        Key: destinationKey,
      };

      const result = await s3.copyObject(params).promise();
      Logger.info(`File copied from ${sourceBucket}/${sourceKey} to ${destinationBucket}/${destinationKey}`);
      return result;
    } catch (error) {
      Logger.error('S3 copy error:', error);
      throw error;
    }
  },

  // Move file within S3 (copy + delete)
  moveFile: async (sourceBucket, sourceKey, destinationBucket, destinationKey) => {
    try {
      // First copy the file
      await S3Service.copyFile(sourceBucket, sourceKey, destinationBucket, destinationKey);
      
      // Then delete the original
      await S3Service.deleteFile(sourceBucket, sourceKey);
      
      Logger.info(`File moved from ${sourceBucket}/${sourceKey} to ${destinationBucket}/${destinationKey}`);
      return { success: true };
    } catch (error) {
      Logger.error('S3 move error:', error);
      throw error;
    }
  },

  // Get file size
  getFileSize: async (bucketName, key) => {
    try {
      const metadata = await S3Service.getFileMetadata(bucketName, key);
      return metadata.ContentLength;
    } catch (error) {
      Logger.error('S3 get file size error:', error);
      throw error;
    }
  },

  // List all buckets
  listBuckets: async () => {
    try {
      const s3 = getS3();
      const result = await s3.listBuckets().promise();
      Logger.info(`Listed ${result.Buckets?.length || 0} buckets`);
      return result;
    } catch (error) {
      Logger.error('S3 list buckets error:', error);
      throw error;
    }
  }
};

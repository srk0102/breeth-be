import crypto from 'crypto'

import { CRYPTO_KEY, CRYPTO_ALGO, CRYPTO_IV } from '../config'

// Ensure we never pass undefined into hash update
const safeKeySource = typeof CRYPTO_KEY !== 'undefined' && CRYPTO_KEY !== null ? String(CRYPTO_KEY) : 'default_dev_key'
const safeIvSource = typeof CRYPTO_IV !== 'undefined' && CRYPTO_IV !== null ? String(CRYPTO_IV) : 'default_dev_iv'

// Use raw digest (Buffer) and slice to get correct byte lengths
const keyHash = crypto.createHash('sha256').update(safeKeySource).digest()
const ivHash = crypto.createHash('sha256').update(safeIvSource).digest()
const key = keyHash.slice(0, 32) // 32 bytes for aes-256
const iv = ivHash.slice(0, 16) // 16 bytes for aes block

const defaultAlgo = 'aes-256-cbc'

export const encrypt = (value) => {
	if (typeof value !== 'string') value = String(value ?? '')
	const algo = CRYPTO_ALGO || defaultAlgo
	const cipher = crypto.createCipheriv(algo, key, iv)
	let encrypted = cipher.update(value, 'utf8', 'hex')
	encrypted += cipher.final('hex')
	return encrypted
}

export const decrypt = (encryptedValue) => {
	if (typeof encryptedValue !== 'string') encryptedValue = String(encryptedValue ?? '')
	const algo = CRYPTO_ALGO || defaultAlgo
	const decipher = crypto.createDecipheriv(algo, key, iv)
	let decrypted = decipher.update(encryptedValue, 'hex', 'utf8')
	decrypted += decipher.final('utf8')
	return decrypted
}

export const compare = (encryptedValue, stringToCompare) => {
	const algo = CRYPTO_ALGO || defaultAlgo
	const decipher = crypto.createDecipheriv(algo, key, iv)
	let decrypted = decipher.update(String(encryptedValue ?? ''), 'hex', 'utf8')
	decrypted += decipher.final('utf8')
	return decrypted === String(stringToCompare ?? '')
}
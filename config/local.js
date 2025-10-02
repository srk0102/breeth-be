require('dotenv').config()

//COMPANY DETAILS
export const APP_NAME = process.env.APP_NAME

//LOCALS
export const NODE_ENV = process.env.NODE_ENV
export const PORT = process.env.PORT ? process.env.PORT : 8000

//DATABASE - Legacy MongoDB (keeping for migration reference)
export const DB_URI = process.env.DB_URI
export const DATABASE_NAME = process.env.DATABASE_NAME

//DYNAMODB
export const AWS_REGION = process.env.AWS_REGION
export const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID
export const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY
export const DYNAMODB_ENDPOINT = process.env.DYNAMODB_ENDPOINT

//CRYPTO KEYS
export const CRYPTO_KEY = process.env.CRYPTO_KEY
export const CRYPTO_IV = process.env.CRYPTO_IV
export const CRYPTO_ALGO = process.env.CRYPTO_ALGO

//JWT
export const JWT_PRIVATE_KEY = process.env.JWT_PRIVATE_KEY
export const JWT_EXPIRY_TOKEN_TIME = process.env.JWT_EXPIRY_TOKEN_TIME
export const JWT_EXPIRY_REFRESH_TIME = process.env.JWT_EXPIRY_REFRESH_TIME
export const JWT_ALGO = process.env.JWT_ALGO
export const JWT_VALIDATION_KEY = process.env.JWT_VALIDATION_KEY

//MARKETPLACE
export const ELEVEN_LABS = process.env.ELEVEN_LABS
import dayjs from 'dayjs'
import Joi from 'joi'
import utc from 'dayjs/plugin/utc'

import { ERRORS } from '../constants'
import { Logger } from './logger'

export const getUtcTime = (date = new Date()) => {
	dayjs.extend(utc)
	return dayjs(date).utc().format()
}

/**
 * @param {RESPONSE} res response object
 * @param {NUMBER} status status code
 * @param {STRING} message message that you want to send to the user
 * @param {OBJECT} data data if anything you want to send to the front end. By default set to empty object
 * @param {ANY} error error message or object or any thing default set to null
 */
export const sendResponse = (res, status, message, data = {}, error = null) => {
	const currentTimeStampInUTC = getUtcTime()
	Logger.info(currentTimeStampInUTC, status, message, error)
	return res.status(status).json(
		{
			status,
			message,
			data,
			error: ERRORS[error] ? ERRORS[error] : error,
			currentTimeStampInUTC,
		}
	)
}

export const pick = (object, keys) => {
	return keys.reduce((obj, key) => {
		if (object && Object.prototype.hasOwnProperty.call(object, key)) {
			obj[key] = object[key]
		}
		return obj
	}, {})
}

export const validateInput = (schema) => (req, res, next) => {
	const validSchema = pick(schema, ['params', 'query', 'body', 'headers'])
	const object = pick(req, Object.keys(validSchema))
	const { value, error } = Joi.compile(validSchema)
		.prefs({ errors: { label: 'key' } })
		.validate(object)
	if (error) {
		const errorMessage = error?.details
			.map((details) => details.message)
			.join(',')
		return sendResponse(res, INVALIDREQUEST, 'Invalid request', {}, errorMessage)
	}
	Object.assign(req, value)
	return next()
}

export const addMinutes = (date, minutes) => {
	date = dayjs(date)
	return date.add(minutes, 'minute')
}

export const addHours = (date, hours) => {
	date = dayjs(date)
	return date.add(hours, 'hour')
}

export const addDays = (date, days) => {
	date = dayjs(date)
	return date.add(days, 'day')
}

export const addMonths = (date, months) => {
	date = dayjs(date)
	return date.add(months, 'month')
}

export const addYears = (date, years) => {
	date = dayjs(date)
	return date.add(years, 'year')
}

export const getMinutesDiff = (date1, date2) => {
	const diffInMilliseconds = Math.abs(new Date(date2).getTime() - new Date(date1).getTime())
	const minutes = Math.floor(diffInMilliseconds / (1000 * 60))
	return minutes
}

/**
 * Format milliseconds into HH:MM:SS.mmm exactly (hours padded to 2, milliseconds to 3)
 * @param {number} ms milliseconds
 * @returns {string} formatted string like "01:02:03.007"
 */
export const formatTimeMs = (ms) => {
	const totalMs = Math.max(0, Math.floor(Number(ms) || 0))
	const hours = Math.floor(totalMs / 3_600_000)
	const minutes = Math.floor((totalMs % 3_600_000) / 60_000)
	const seconds = Math.floor((totalMs % 60_000) / 1000)
	const milliseconds = totalMs % 1000

	const hh = String(hours).padStart(2, '0')
	const mm = String(minutes).padStart(2, '0')
	const ss = String(seconds).padStart(2, '0')
	const mmm = String(milliseconds).padStart(3, '0')

	return `${hh}:${mm}:${ss}.${mmm}`
}
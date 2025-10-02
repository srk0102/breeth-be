import JoiBase from 'joi'
import JoiDate from '@joi/date'
import dayjs from 'dayjs'
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter'
import customParseFormat from 'dayjs/plugin/customParseFormat'

const Joi = JoiBase.extend(JoiDate) // extend Joi with Joi Date

import { DATEFORMAT, PASSWORD_REGEX, USERTYPE } from '../constants'

export const commonValidation = {
	otp: Joi.string().min(4).max(4),
	email: Joi.string().email(),
	fullName: Joi.string().min(1).max(75),
	dob: Joi.date().format(DATEFORMAT).raw(),
	source: Joi.string().lowercase().trim(),
	password: Joi.string().min(8).max(16).pattern(PASSWORD_REGEX).message('password should contain at-least one capital letter, one small letter, one symbol and one number.The length of password should be in between 8-16.'),
	userType: Joi.string().valid(...USERTYPE).trim(),
	country: Joi.string().min(4).max(16).trim(),
	profilePic: Joi.string().trim(),
	description: Joi.string().trim(),
	emailComm: Joi.boolean(),
	isActive: Joi.boolean(),
	startDate: Joi.string(),
	endDate: Joi.string(),
	limit: Joi.number().default(25).max(25),
	pageNo: Joi.number().default(1),
	memberId: Joi.string().required(),
	referralCode: Joi.string(),
	memberIds: Joi.array().min(1).required()
}

export const dobValidation = (dob) => {
	if (!dob) {
		return { isSuccess: true }
	}
	dayjs.extend(customParseFormat)
	if (!dayjs(dob, 'DD/MM/YYYY', true).isValid()) {
		return { isSuccess: false, message: 'Date of birth is invalid' }
	}
	let dobV = dob.split('/')
	let dobM = dayjs(`${dobV[2]}/${dobV[1]}/${dobV[0]}`).add(1, 'day')

	if (dayjs(dobM).isAfter(dayjs().subtract(18, 'year'))) {
		return { isSuccess: false, message: 'Your age must be greater then 18 years' }
	}

	if (dayjs(dobM).isBefore(dayjs().subtract(80, 'year'))) {
		return { isSuccess: false, message: 'Your age must be less then 80 years' }
	}

	dayjs.extend(isSameOrAfter)
	if (dayjs(dobM).isSameOrAfter(dayjs())) {
		return { isSuccess: false, message: 'Date of birth is invalid' }
	}
	return { isSuccess: true }
}
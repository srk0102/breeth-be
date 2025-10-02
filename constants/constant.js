export const SECONDSINDAY = 60 * 60 * 24
export const SECONDSINHOUR = 60 * 60
export const FIFTEENMINUTES = 15
export const TENMINUTES = 10
export const FIVEMINUTES = 5
export const INVALIDATTEMPTS = 5
export const MAXALLOWEDLOGINS = 5
export const LIMIT = 50
export const EMAIL = 'email'
export const USER = 'user'
export const TOKEN_STATUS = ['active', 'expired', 'suspended', 'loggedout']
export const GENDER = ['Male', 'Female', 'Other', 'prefer not to say']
export const USERTYPE = ['CREATOR', 'EDITOR']
export const SIGNUP = 'signup'
export const SIGNIN = 'signin'
export const RESETPASSWORD = 'resetpassword'
export const SUBSCRIBE = 'subscribe'
export const SESSION_UID_LENGTH = 18
export const PHONE_REGEX = /^[0-9]{8,14}$/
export const COUNTRY_CODE_REGEX = /^(\+?\d{1,3}|\d{1,3})$/
export const DEFAULT_COUNTRY_CODE = '+91'
export const NAME_REGEX = /^[a-zA-z.' ]+([ ][a-zA-Z.' ]+)*$/
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,16}$/

export const ENTRY_TYPE = ['general', 'google']

export const EMAIL_TEMPLATE_KEYS = {
	resetPassword: 'reset-password',
	verifyEmail: 'emailVerification',
	welcome: 'welcome'
}

export const DATEFORMAT = 'DD/MM/YYYY'

export const VALIDATION_TOKENS= {
	emailVerification : 'email-verification',
	resetPassword: 'reset-password'
}
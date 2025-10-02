import { APP_NAME } from '../config'

import { Logger } from '../utils'

import { RunnerRouter } from './runner'

const Routes = [
	{ path: '/runners', router: RunnerRouter },
]

Routes.init = (app) => {
 	try {
 		Routes.forEach(route => {
 			app.use([`/${APP_NAME}`, route.path].join(''), route.router)
 		})
 	}
 	catch (err) {
 		Logger.error(err)
 	}
}

export { Routes }
import { TemplatedApp } from 'uWebSockets.js'
import ServerConfig from '../server.config'
import Console from '../utils/ConsoleHandler'
import ISRHandler from './utils/ISRHandler'

const puppeteerSSRService = (() => {
	let _app: TemplatedApp

	const _allRequestHandler = () => {
		_app.get('/*', async function (res, req) {
			const startGenerating = Number(req.getQuery('startGenerating'))
			const crawlerSecretKey = req.getQuery('crawlerSecretKey')
			const isFirstRequest = !!req.getQuery('isFirstRequest')
			const url = req.getQuery('url') || ''

			if(crawlerSecretKey !== ServerConfig.crawlerSecretKey) res
				.writeStatus('500')
				.end('Access is denied!')
			else if(!url) res.writeStatus('500').end('URL param is empty!', true)
			else {
				res.onAborted(() => {
					Console.log('Request aborted')
				})

				const result = await ISRHandler({
					startGenerating,
					isFirstRequest,
					url,
				})

				res.cork(() => {
					if(!result) {
						res.writeStatus('500').end('Server Error', true)
					} else {
						res
						.writeStatus(String(result.status))
						.writeHeader(
							'Content-Type',
							'text/html; charset=utf-8'
						)
						.end(result.html, true)
					}
				})
			}
		})
	}

	return {
		init(app: TemplatedApp) {
			if (!app) return Console.warn('You need provide express app!')
			_app = app
			_allRequestHandler()
		},
	}
})()

export default puppeteerSSRService

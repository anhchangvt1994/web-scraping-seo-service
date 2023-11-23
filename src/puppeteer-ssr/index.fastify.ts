import { FastifyInstance } from 'fastify'
import ServerConfig from '../server.config'
import Console from '../utils/ConsoleHandler'
import ISRHandler from './utils/ISRHandler'

const puppeteerSSRService = (() => {
	let _app: FastifyInstance

	const _allRequestHandler = () => {
		_app.get('*', async function (req, res) {
			const startGenerating = Number(req.query?.['startGenerating'])
			const crawlerSecretKey = req.query?.['crawlerSecretKey']
			const isFirstRequest = !!req.query?.['isFirstRequest']
			const url = req.query?.['url']
				? (decodeURIComponent(req.query?.['url'] as string) as string)
				: ''

			res.raw.setHeader(
				'Content-Type',
				'text/html; charset=utf-8'
			)

			if(crawlerSecretKey !== ServerConfig.crawlerSecretKey) return res
			.status(500)
			.send('Access is denied!')
			if(!url) return res.status(500)
			.send('URL param is empty!')

			const result = await ISRHandler({
				startGenerating,
				isFirstRequest,
				url,
			})

			if(!result) {
				return res.status(500)
				.send('Server Error')
			}

			res
			.status(result.status)
			.send(result.html)
		})
	}

	return {
		init(app: FastifyInstance) {
			if (!app) return Console.warn('You need provide express app!')
			_app = app
			_allRequestHandler()
		},
	}
})()

export default puppeteerSSRService

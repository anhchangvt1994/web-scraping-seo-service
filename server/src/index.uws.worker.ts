import fs from 'fs'
import path from 'path'
import { Browser } from 'puppeteer-core'
import {
	findFreePort,
	getPort,
	setPort,
} from './../../config/utils/PortHandler'
import BrowserManager from './puppeteer-ssr/utils/BrowserManager'
import ServerConfig from './server.config'
import Console from './utils/ConsoleHandler'
import { ENV_MODE, PROCESS_ENV } from './utils/InitEnv'

const {
	Worker,
	isMainThread,
	parentPort,
	workerData,
} = require('worker_threads')
require('events').EventEmitter.setMaxListeners(200)

const startServer = async () => {
	if (isMainThread) {
		let port =
			PROCESS_ENV.PORT || ENV_MODE === 'production'
				? PROCESS_ENV.PORT || 8080
				: getPort('PUPPETEER_SSR_PORT')

		if (!port) {
			port = await findFreePort(port || PROCESS_ENV.PUPPETEER_SSR_PORT || 8080)
			setPort(port, 'PUPPETEER_SSR_PORT')
		}

		PROCESS_ENV.PORT = port

		const app = require('uWebSockets.js')./*SSL*/ App({
			key_file_name: 'misc/key.pem',
			cert_file_name: 'misc/cert.pem',
		})

		app.listen(Number(port), (token) => {
			if (token) {
				console.log(`Server started port ${port}. Press Ctrl+C to quit`)
				process.send?.('ready')
				process.title = 'web-scraping'
			} else {
				console.log(`Failed to listen to port ${port}`)
			}
		})

		import('./utils/CleanerService').catch((err) => {
			Console.error(err.message)
		})

		process.on('SIGINT', async function () {
			await app.close()
			process.exit(0)
		})

		const browserManager = BrowserManager()
		const browserList = new Map<string, Browser>()

		const _createWorkerListener = (worker) => {
			if (!worker) return

			worker.on('message', async (payload) => {
				if (!browserManager || !payload) return

				if (payload.name === 'acceptor') {
					app.addChildAppDescriptor(payload.value)
				} else if (payload.name === 'getBrowser') {
					const browser = await browserManager.get()
					if (
						browser &&
						browser.connected &&
						!browserList.has(browser.wsEndpoint())
					) {
						const wsEndpoint = browser.wsEndpoint()
						browserList.set(wsEndpoint, browser as Browser)
						browser.once('closed', () => {
							browserList.delete(wsEndpoint)
						})
					}
				} else if (payload.name === 'closePage') {
					if (payload.wsEndpoint) {
						const browser = browserList.get(payload.wsEndpoint)
						if (!browser || !browser.connected) return
						browser.emit('closePage', payload.url)
					}
				}
			})
		} // _createWorkerListener

		// Spawn two worker threads
		const worker1 = new Worker(__filename, {
			workerData: { order: 1, port: 4040 },
		})
		_createWorkerListener(worker1)
		const worker2 = new Worker(__filename, {
			workerData: { order: 2, port: 4041 },
		})
		_createWorkerListener(worker2)
		const worker3 = new Worker(__filename, {
			workerData: { order: 3, port: 4042 },
		})
		_createWorkerListener(worker3)
		const worker4 = new Worker(__filename, {
			workerData: { order: 4, port: 4043 },
		})
		_createWorkerListener(worker4)
		const worker5 = new Worker(__filename, {
			workerData: { order: 5, port: 4044 },
		})
		_createWorkerListener(worker5)
	} else {
		const setupCors = (res) => {
			res
				.writeHeader('Access-Control-Allow-Origin', '*')
				.writeHeader('Access-Control-Allow-Credentials', 'true')
				.writeHeader(
					'Access-Control-Allow-Methods',
					'GET, POST, PUT, DELETE, OPTIONS'
				)
				.writeHeader(
					'Access-Control-Allow-Headers',
					'origin, content-type, accept,' +
						' x-requested-with, authorization, lang, domain-key, Access-Control-Allow-Origin'
				)
				.writeHeader('Access-Control-Max-Age', '2592000')
				.writeHeader('Vary', 'Origin')
		}

		const port = await findFreePort(workerData?.port ?? 4040)

		PROCESS_ENV.PORT = port

		const app = require('uWebSockets.js')./*SSL*/ App({
			key_file_name: 'misc/key.pem',
			cert_file_name: 'misc/cert.pem',
		})

		app.any('/*', (res, req) => {
			setupCors(res)

			res.end('', true) // end the request
		})

		if (!ServerConfig.isRemoteCrawler) {
			app.get('/robots.txt', (res, req) => {
				try {
					const body = fs.readFileSync(path.resolve(__dirname, '../robots.txt'))
					res.end(body, true)
				} catch {
					res.writeStatus('404')
					res.end('File not found', true)
				}
			})
		}

		;(await require('./api/index.uws').default).init(app)
		;(await require('./puppeteer-ssr/index.uws').default).init(app)

		app.listen(Number(port), (token) => {
			if (token) {
				console.log(`Server started port ${port}. Press Ctrl+C to quit`)
				process.send?.('ready')
				process.title = 'web-scraping'
			} else {
				console.log(`Failed to listen to port ${port}`)
			}
		})

		process.on('SIGINT', async function () {
			await app.close()
			process.exit(0)
		})

		/* The worker sends back its descriptor to the main acceptor */
		parentPort.postMessage({
			name: 'acceptor',
			value: app.getDescriptor(),
		})
	}
}

startServer()

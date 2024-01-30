import fs from 'fs'
import path from 'path'
import { HttpResponse, TemplatedApp } from 'uWebSockets.js'
import { brotliCompressSync, brotliDecompressSync, gzipSync } from 'zlib'
import { COOKIE_EXPIRED, IS_REMOTE_CRAWLER, SERVER_LESS } from '../constants'
import DetectBotMiddle from '../middlewares/uws/DetectBot'
import DetectDeviceMiddle from '../middlewares/uws/DetectDevice'
import DetectLocaleMiddle from '../middlewares/uws/DetectLocale'
import DetectRedirectMiddle from '../middlewares/uws/DetectRedirect'
import DetectStaticMiddle from '../middlewares/uws/DetectStatic'
import ServerConfig from '../server.config'
import { IBotInfo } from '../types'
import CleanerService from '../utils/CleanerService'
import Console from '../utils/ConsoleHandler'
import { ENV, ENV_MODE, MODE, PROCESS_ENV } from '../utils/InitEnv'
import { CACHEABLE_STATUS_CODE, DISABLE_SSR_CACHE } from './constants'
import { convertUrlHeaderToQueryString, getUrl } from './utils/ForamatUrl.uws'
import ISRGenerator from './utils/ISRGenerator.next'
import SSRHandler from './utils/ISRHandler'

const COOKIE_EXPIRED_SECOND = COOKIE_EXPIRED / 1000

const puppeteerSSRService = (async () => {
	let _app: TemplatedApp
	const webScrapingService = 'web-scraping-service'
	const cleanerService = 'cleaner-service'

	const _setCookie = (res: HttpResponse) => {
		res
			.writeHeader(
				'set-cookie',
				`EnvironmentInfo=${JSON.stringify(
					res.cookies.environmentInfo
				)};Max-Age=${COOKIE_EXPIRED_SECOND};Path=/`
			)
			.writeHeader(
				'set-cookie',
				`BotInfo=${JSON.stringify(
					res.cookies.botInfo
				)};Max-Age=${COOKIE_EXPIRED_SECOND};Path=/`
			)
			.writeHeader(
				'set-cookie',
				`DeviceInfo=${JSON.stringify(
					res.cookies.deviceInfo
				)};Max-Age=${COOKIE_EXPIRED_SECOND};Path=/`
			)
			.writeHeader(
				'set-cookie',
				`LocaleInfo=${JSON.stringify(
					res.cookies.localeInfo
				)};Max-Age=${COOKIE_EXPIRED_SECOND};Path=/`
			)

		return res
	} // _setCookie

	const _resetCookie = (res: HttpResponse) => {
		res
			.writeHeader('set-cookie', `EnvironmentInfo=;Max-Age=0;Path=/`)
			.writeHeader('set-cookie', `BotInfo=;Max-Age=0;Path=/`)
			.writeHeader('set-cookie', `DeviceInfo=;Max-Age=0;Path=/`)

		return res
	} // _resetCookie

	const _allRequestHandler = () => {
		if (SERVER_LESS) {
			_app
				.get('/web-scraping', async function (res, req) {
					if (req.getHeader('authorization') !== webScrapingService)
						res
							.writeStatus('200')
							.end(
								'Welcome to MTr Web Scraping Service, please provide authorization to use it.',
								true
							)
					else {
						const startGenerating = Number(req.getQuery('startGenerating'))
						const isFirstRequest = !!req.getQuery('isFirstRequest')
						const url = req.getQuery('url') || ''

						res.onAborted(() => {
							Console.log('Request aborted')
						})

						const result = await SSRHandler({
							startGenerating,
							isFirstRequest,
							url,
						})

						res.cork(() => {
							res
								.writeStatus('200')
								.end(result ? JSON.stringify(result) : '{}', true)
						})
					}
				})
				.post('/cleaner-service', async function (res, req) {
					if (req.getHeader('authorization') !== cleanerService)
						res
							.writeStatus('200')
							.end(
								'Welcome to MTr Cleaner Service, please provide authorization to use it.',
								true
							)
					else if (!SERVER_LESS)
						res
							.writeStatus('200')
							.end(
								'MTr cleaner service can not run in none serverless environment'
							)
					else {
						res.onAborted(() => {
							Console.log('Request aborted')
						})

						await CleanerService()

						Console.log('Finish clean service!')

						res.cork(() => {
							res.writeStatus('200').end('Finish clean service!', true)
						})
					}
				})
		}
		_app.get('/*', async function (res, req) {
			DetectStaticMiddle(res, req)

			// NOTE - Check if static will send static file
			if (res.writableEnded) return

			// NOTE - Check and create base url
			if (!PROCESS_ENV.BASE_URL)
				PROCESS_ENV.BASE_URL = `${
					req.getHeader('x-forwarded-proto')
						? req.getHeader('x-forwarded-proto')
						: 'http'
				}://${req.getHeader('host')}`

			// NOTE - Detect, setup BotInfo and LocaleInfo
			DetectBotMiddle(res, req)
			DetectLocaleMiddle(res, req)

			const botInfo: IBotInfo = res.cookies?.botInfo

			if (
				IS_REMOTE_CRAWLER &&
				((ServerConfig.crawlerSecretKey &&
					req.getQuery('crawlerSecretKey') !== ServerConfig.crawlerSecretKey) ||
					(!botInfo.isBot && DISABLE_SSR_CACHE))
			) {
				return res.writeStatus('403').end('403 Forbidden', true)
			}

			// NOTE - Check redirect or not
			const isRedirect = DetectRedirectMiddle(res, req)

			/**
			 * NOTE
			 * - We need crawl page although this request is not a bot
			 * When we request by enter first request, redirect will checked and will redirect immediately in server. But when we change router in client side, the request will be a extra fetch from client to server to check redirect information, in this case redirect will run in client not server and won't any request call to server after client run redirect. So we need crawl page in server in the first fetch request that client call to server (if header.accept is 'application/json' then it's fetch request from client)
			 */
			if (
				(res.writableEnded && botInfo.isBot) ||
				(isRedirect && req.getHeader('accept') !== 'application/json')
			)
				return

			// NOTE - Detect DeviceInfo
			DetectDeviceMiddle(res, req)

			// NOTE - Set cookies for EnvironmentInfo
			res.cookies.environmentInfo = (() => {
				const tmpEnvironmentInfo =
					req.getHeader('environmentinfo') || req.getHeader('environmentInfo')

				if (tmpEnvironmentInfo) return JSON.parse(tmpEnvironmentInfo)

				return {
					ENV,
					MODE,
					ENV_MODE,
				}
			})()

			const enableISR =
				ServerConfig.isr.enable &&
				Boolean(
					!ServerConfig.isr.routes ||
						!ServerConfig.isr.routes[req.getUrl()] ||
						ServerConfig.isr.routes[req.getUrl()].enable ||
						!ServerConfig.isr.routes[res.urlForCrawler] ||
						ServerConfig.isr.routes[res.urlForCrawler].enable
				)

			const enableContentEncoding = Boolean(req.getHeader('accept-encoding'))
			const contentEncoding = (() => {
				const tmpHeaderAcceptEncoding = req.getHeader('accept-encoding') || ''
				if (tmpHeaderAcceptEncoding.indexOf('br') !== -1) return 'br'
				else if (tmpHeaderAcceptEncoding.indexOf('gzip') !== -1) return 'gzip'
				return '' as 'br' | 'gzip' | ''
			})()

			if (
				ENV_MODE !== 'development' &&
				enableISR &&
				req.getHeader('service') !== 'puppeteer'
			) {
				const url = convertUrlHeaderToQueryString(
					getUrl(res, req),
					res,
					!botInfo.isBot
				)

				if (botInfo.isBot) {
					res.onAborted(() => {
						Console.log('Request aborted')
					})

					try {
						const result = await ISRGenerator({
							url,
						})

						res.cork(() => {
							if (result) {
								/**
								 * NOTE
								 * calc by using:
								 * https://www.inchcalculator.com/convert/year-to-second/
								 */
								res.writeStatus(String(result.status))

								if (enableContentEncoding && result.status === 200) {
									res.writeHeader('Content-Encoding', contentEncoding)
								}

								if (result.status === 503) res.writeHeader('Retry-After', '120')

								// Add Server-Timing! See https://w3c.github.io/server-timing/.
								if (
									(CACHEABLE_STATUS_CODE[result.status] ||
										result.status === 503) &&
									result.response
								) {
									try {
										res = _setCookie(res)
										const body = (() => {
											let tmpBody: string | Buffer = ''

											if (enableContentEncoding) {
												tmpBody = result.html
													? contentEncoding === 'br'
														? brotliCompressSync(result.html)
														: contentEncoding === 'gzip'
														? gzipSync(result.html)
														: result.html
													: fs.readFileSync(result.response)
											} else if (result.response.indexOf('.br') !== -1) {
												const content = fs.readFileSync(result.response)

												tmpBody = brotliDecompressSync(content).toString()
											} else {
												tmpBody = fs.readFileSync(result.response)
											}

											return tmpBody
										})()

										res.end(body, true)
									} catch {
										res.writeStatus('404').end('Page not found!', true)
									}
								} else if (result.html) {
									if (result.status === 200) {
										res
											.writeHeader(
												'Server-Timing',
												`Prerender;dur=50;desc="Headless render time (ms)"`
											)
											.writeHeader('Cache-Control', 'no-store')
									}

									const body = enableContentEncoding
										? brotliCompressSync(result.html)
										: result.html

									res.end(body || '', true)
								} else {
									res.end(`${result.status} Error`, true)
								}
							} else {
								res.writeStatus('504').end('504 Gateway Timeout', true)
							}
						})
					} catch (err) {
						Console.error('url', url)
						Console.error(err)
						// NOTE - Error: uWS.HttpResponse must not be accessed after uWS.HttpResponse.onAborted callback, or after a successful response. See documentation for uWS.HttpResponse and consult the user manual.
						res.writeStatus('500').end('Server Error!', true)
					}

					res.writableEnded = true
				} else if (
					!botInfo.isBot &&
					(!DISABLE_SSR_CACHE || ServerConfig.crawler)
				) {
					try {
						if (SERVER_LESS) {
							await ISRGenerator({
								url,
								isSkipWaiting: true,
							})
						} else {
							ISRGenerator({
								url,
								isSkipWaiting: true,
							})
						}
					} catch (err) {
						Console.error('url', url)
						Console.error(err)
					}
				}
			}

			if (!res.writableEnded) {
				/**
				 * NOTE
				 * Cache-Control max-age is 1 year
				 * calc by using:
				 * https://www.inchcalculator.com/convert/year-to-second/
				 */
				if (req.getHeader('accept') === 'application/json') {
					res.writeStatus('200')

					res = _setCookie(res)
					res = _resetCookie(res)
					res.end(
						JSON.stringify({
							status: 200,
							originPath: req.getUrl(),
							path: req.getUrl(),
						}),
						true
					)
				} else {
					const filePath =
						(req.getHeader('static-html-path') as string) ||
						path.resolve(__dirname, '../../../dist/index.html')

					try {
						const body = fs.readFileSync(filePath)
						res
							.writeStatus('200')
							.writeHeader(
								'Content-Type',
								req.getHeader('accept') === 'application/json'
									? 'application/json'
									: 'text/html; charset=utf-8'
							)
						res = _setCookie(res)
						res
							.writeHeader('Cache-Control', 'no-store')
							.writeHeader('etag', 'false')
							.writeHeader('lastModified', 'false')

						// NOTE - Setup cookie information
						if (res.cookies.lang)
							res.writeHeader('set-cookie', `lang=${res.cookies.lang};Path=/`)
						if (res.cookies.country)
							res.writeHeader(
								'set-cookie',
								`country=${res.cookies.country};Path=/`
							)

						res.end(body, true)
					} catch {
						res
							.writeStatus('404')
							.writeHeader(
								'Content-Type',
								req.getHeader('accept') === 'application/json'
									? 'application/json'
									: 'text/html; charset=utf-8'
							)
							.end('File not found!', true)
					}
				}
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

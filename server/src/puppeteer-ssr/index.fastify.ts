import { FastifyInstance, FastifyRequest } from 'fastify'
import fs from 'fs'
import path from 'path'
import { brotliCompressSync, brotliDecompressSync, gzipSync } from 'zlib'
import { SERVER_LESS } from '../constants'
import ServerConfig from '../server.config'
import { IBotInfo } from '../types'
import CleanerService from '../utils/CleanerService'
import Console from '../utils/ConsoleHandler'
import { getCookieFromResponse, setCookie } from '../utils/CookieHandler'
import { ENV_MODE } from '../utils/InitEnv'
import sendFile from '../utils/SendFile'
import { CACHEABLE_STATUS_CODE } from './constants'
import { convertUrlHeaderToQueryString, getUrl } from './utils/ForamatUrl'
import ISRGenerator from './utils/ISRGenerator.next'
import ISRHandler from './utils/ISRHandler'

const _resetCookie = (res) => {
	setCookie(res, `BotInfo=;Max-Age=0;Path=/`)
	setCookie(res, `EnvironmentInfo=;Max-Age=0;Path=/`)
	setCookie(res, `DeviceInfo=;Max-Age=0;Path=/`)
} // _resetCookie

const puppeteerSSRService = (async () => {
	let _app: FastifyInstance
	const webScrapingService = 'web-scraping-service'
	const cleanerService = 'cleaner-service'

	const _allRequestHandler = () => {
		if (SERVER_LESS) {
			_app
				.get('/web-scraping', async function (req, res) {
					if (req.headers.authorization !== webScrapingService)
						return res
							.status(200)
							.send(
								'Welcome to MTr Web Scraping Service, please provide authorization to use it.'
							)

					const startGenerating = Number(req.query?.['startGenerating'])
					const isFirstRequest = !!req.query?.['isFirstRequest']
					const url = req.query?.['url']
						? (decodeURIComponent(req.query?.['url'] as string) as string)
						: ''

					const result = await ISRHandler({
						startGenerating,
						hasCache: isFirstRequest,
						url,
					})

					res.status(200).send(result || {})
				})
				.post('/cleaner-service', async function (req, res) {
					if (req.headers.authorization !== cleanerService)
						return res
							.status(200)
							.send(
								'Welcome to MTr Cleaner Service, please provide authorization to use it.'
							)
					else if (!SERVER_LESS)
						return res
							.status(200)
							.send(
								'MTr cleaner service can not run in none serverless environment'
							)

					await CleanerService()

					Console.log('Finish clean service!')

					res.status(200).send('Finish clean service!')
				})
		}
		_app.get(
			'*',
			async function (
				req: FastifyRequest<{
					Querystring: { [key: string]: any }
				}>,
				res
			) {
				const pathname = req.url?.split('?')[0]
				const cookies = getCookieFromResponse(res)
				const botInfo: IBotInfo = cookies?.['BotInfo']
				const { enableToCrawl, enableToCache } = (() => {
					let enableToCrawl = ServerConfig.crawl.enable
					let enableToCache = enableToCrawl && ServerConfig.crawl.cache.enable

					const crawlOptionPerRoute =
						ServerConfig.crawl.routes[pathname] ||
						ServerConfig.crawl.custom?.(pathname)

					if (crawlOptionPerRoute) {
						enableToCrawl = crawlOptionPerRoute.enable
						enableToCache = enableToCrawl && crawlOptionPerRoute.cache.enable
					}
					return {
						enableToCrawl,
						enableToCache,
					}
				})()

				const headers = req.headers
				const enableContentEncoding = Boolean(headers['accept-encoding'])
				const contentEncoding = (() => {
					const tmpHeaderAcceptEncoding = headers['accept-encoding'] || ''
					if (tmpHeaderAcceptEncoding.indexOf('br') !== -1) return 'br'
					else if (tmpHeaderAcceptEncoding.indexOf('gzip') !== -1) return 'gzip'
					return '' as 'br' | 'gzip' | ''
				})()

				Console.log('<---puppeteer/index.fastify.ts--->')
				Console.log('enableContentEncoding: ', enableContentEncoding)
				Console.log(`headers['accept-encoding']: `, headers['accept-encoding'])
				Console.log('contentEncoding: ', contentEncoding)
				Console.log('<---puppeteer/index.fastify.ts--->')

				res.raw.setHeader(
					'Content-Type',
					headers.accept === 'application/json'
						? 'application/json'
						: 'text/html; charset=utf-8'
				)

				if (
					ServerConfig.isRemoteCrawler &&
					((ServerConfig.crawlerSecretKey &&
						req.query.crawlerSecretKey !== ServerConfig.crawlerSecretKey) ||
						(!botInfo.isBot && enableToCache))
				) {
					return res.status(403).send('403 Forbidden')
				}

				if (
					ENV_MODE !== 'development' &&
					enableToCrawl &&
					headers.service !== 'puppeteer'
				) {
					const url = convertUrlHeaderToQueryString(
						getUrl(req),
						res as any,
						!botInfo.isBot
					)
					if (!req.headers['redirect'] && botInfo.isBot) {
						try {
							const result = await ISRGenerator({
								url,
							})

							if (result) {
								/**
								 * NOTE
								 * calc by using:
								 * https://www.inchcalculator.com/convert/year-to-second/
								 */
								res.raw.setHeader(
									'Server-Timing',
									`Prerender;dur=50;desc="Headless render time (ms)"`
								)
								res.raw.setHeader('Cache-Control', 'no-store')
								res.raw.statusCode = result.status
								if (enableContentEncoding && result.status === 200) {
									res.raw.setHeader('Content-Encoding', contentEncoding)
								}

								if (result.status === 503) res.header('Retry-After', '120')
							} else {
								return res.status(504).send('504 Gateway Timeout')
							}

							if (
								(CACHEABLE_STATUS_CODE[result.status] ||
									result.status === 503) &&
								result.response
							) {
								const body = (() => {
									let tmpBody: string | Buffer = ''

									if (enableContentEncoding) {
										tmpBody = result.html
											? contentEncoding === 'br'
												? brotliCompressSync(result.html)
												: contentEncoding === 'gzip'
												? gzipSync(result.html)
												: result.html
											: (() => {
													let tmpContent: Buffer | string = fs.readFileSync(
														result.response
													)

													if (contentEncoding === 'br') return tmpContent
													else
														tmpContent =
															brotliDecompressSync(tmpContent).toString()

													if (result.status === 200) {
														if (contentEncoding === 'gzip')
															tmpContent = gzipSync(tmpContent)
													}

													return tmpContent
											  })()
									} else if (result.response.indexOf('.br') !== -1) {
										const content = fs.readFileSync(result.response)

										tmpBody = brotliDecompressSync(content).toString()
									} else {
										tmpBody = fs.readFileSync(result.response)
									}

									return tmpBody
								})()

								return res.send(body)
							}
							// Serve prerendered page as response.
							else {
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

								res.send(body)
							}
						} catch (err) {
							Console.error('url', url)
							Console.error(err)
						}

						return
					} else if (!botInfo.isBot) {
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

				/**
				 * NOTE
				 * Cache-Control max-age is 1 year
				 * calc by using:
				 * https://www.inchcalculator.com/convert/year-to-second/
				 */
				if (headers.accept === 'application/json') {
					_resetCookie(res)
					res
						.header('Cache-Control', 'no-store')
						.send(
							req.headers['redirect']
								? JSON.parse(req.headers['redirect'] as string)
								: { status: 200, originPath: pathname, path: pathname }
						)
				} else {
					const filePath =
						(req.headers['static-html-path'] as string) ||
						path.resolve(__dirname, '../../../dist/index.html')
					res.raw.setHeader('Cache-Control', 'no-store')
					return sendFile(filePath, res.raw)
				}
			}
		)
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

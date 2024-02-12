'use strict'
function _interopRequireDefault(obj) {
	return obj && obj.__esModule ? obj : { default: obj }
}
function _nullishCoalesce(lhs, rhsFn) {
	if (lhs != null) {
		return lhs
	} else {
		return rhsFn()
	}
}
function _optionalChain(ops) {
	let lastAccessLHS = undefined
	let value = ops[0]
	let i = 1
	while (i < ops.length) {
		const op = ops[i]
		const fn = ops[i + 1]
		i += 2
		if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) {
			return undefined
		}
		if (op === 'access' || op === 'optionalAccess') {
			lastAccessLHS = value
			value = fn(value)
		} else if (op === 'call' || op === 'optionalCall') {
			value = fn((...args) => value.call(lastAccessLHS, ...args))
			lastAccessLHS = undefined
		}
	}
	return value
}
var _middie = require('@fastify/middie')
var _middie2 = _interopRequireDefault(_middie)
var _child_process = require('child_process')
var _cors = require('cors')
var _cors2 = _interopRequireDefault(_cors)
var _fastify = require('fastify')
var _fastify2 = _interopRequireDefault(_fastify)
var _fs = require('fs')
var _fs2 = _interopRequireDefault(_fs)
var _path = require('path')
var _path2 = _interopRequireDefault(_path)
var _servestatic = require('serve-static')
var _servestatic2 = _interopRequireDefault(_servestatic)
var _zlib = require('zlib')
var _PortHandler = require('../../config/utils/PortHandler')
var _constants = require('./constants')
var _serverconfig = require('./server.config')
var _serverconfig2 = _interopRequireDefault(_serverconfig)
var _CookieHandler = require('./utils/CookieHandler')
var _DetectBot = require('./utils/DetectBot')
var _DetectBot2 = _interopRequireDefault(_DetectBot)
var _DetectDevice = require('./utils/DetectDevice')
var _DetectDevice2 = _interopRequireDefault(_DetectDevice)
var _DetectLocale = require('./utils/DetectLocale')
var _DetectLocale2 = _interopRequireDefault(_DetectLocale)
var _DetectRedirect = require('./utils/DetectRedirect')
var _DetectRedirect2 = _interopRequireDefault(_DetectRedirect)
var _DetectStaticExtension = require('./utils/DetectStaticExtension')
var _DetectStaticExtension2 = _interopRequireDefault(_DetectStaticExtension)
var _InitEnv = require('./utils/InitEnv')
var _SendFile = require('./utils/SendFile')
var _SendFile2 = _interopRequireDefault(_SendFile)

const COOKIE_EXPIRED_SECOND = _constants.COOKIE_EXPIRED / 1000

require('events').EventEmitter.setMaxListeners(200)

const cleanResourceWithCondition = async () => {
	if (_InitEnv.ENV_MODE === 'development') {
		// NOTE - Clean Browsers and Pages after start / restart
		const {
			deleteResource,
		} = require(`./puppeteer-ssr/utils/FollowResource.worker/utils.${_constants.resourceExtension}`)
		const browsersPath = _path2.default.resolve(
			__dirname,
			'./puppeteer-ssr/browsers'
		)

		return Promise.all([
			deleteResource(browsersPath),
			deleteResource(_constants.pagesPath),
		])
	}
}

const startServer = async () => {
	await cleanResourceWithCondition()
	let port =
		_InitEnv.ENV !== 'development'
			? _InitEnv.PROCESS_ENV.PORT ||
			  _PortHandler.getPort.call(void 0, 'PUPPETEER_SSR_PORT')
			: _PortHandler.getPort.call(void 0, 'PUPPETEER_SSR_PORT')
	port = await _PortHandler.findFreePort.call(
		void 0,
		port || _InitEnv.PROCESS_ENV.PUPPETEER_SSR_PORT || 8080
	)
	_PortHandler.setPort.call(void 0, port, 'PUPPETEER_SSR_PORT')

	if (_InitEnv.ENV !== 'development') {
		_InitEnv.PROCESS_ENV.PORT = port
	}

	const app = _fastify2.default.call(void 0)

	await app.register(_middie2.default, {
		hook: 'onRequest', // default
	})

	app.use(_cors2.default.call(void 0))

	if (
		_serverconfig2.default.crawler &&
		!_InitEnv.PROCESS_ENV.IS_REMOTE_CRAWLER
	) {
		app
			.use(
				'/robots.txt',
				_servestatic2.default.call(
					void 0,
					_path2.default.resolve(__dirname, '../robots.txt')
				)
			)
			.use(function (req, res, next) {
				const isStatic = _DetectStaticExtension2.default.call(void 0, req)
				/**
				 * NOTE
				 * Cache-Control max-age is 1 year
				 * calc by using:
				 * https://www.inchcalculator.com/convert/month-to-second/
				 */

				if (isStatic) {
					const staticPath = _path2.default.resolve(
						__dirname,
						`../../dist/${req.url}`
					)

					if (_InitEnv.ENV === 'development') {
						res.setHeader('Cache-Control', 'public, max-age=31556952')
						_SendFile2.default.call(void 0, staticPath, res)
					} else {
						try {
							const contentEncoding = (() => {
								const tmpHeaderAcceptEncoding =
									req.headers['accept-encoding'] || ''
								if (tmpHeaderAcceptEncoding.indexOf('br') !== -1) return 'br'
								else if (tmpHeaderAcceptEncoding.indexOf('gzip') !== -1)
									return 'gzip'
								return ''
							})()

							const body = (() => {
								const content = _fs2.default.readFileSync(staticPath)
								const tmpBody =
									contentEncoding === 'br'
										? _zlib.brotliCompressSync.call(void 0, content)
										: contentEncoding === 'gzip'
										? _zlib.gzipSync.call(void 0, content)
										: content

								return tmpBody
							})()

							const mimeType = _servestatic2.default.mime.lookup(staticPath)

							res
								.writeHead(200, {
									'cache-control': 'public, max-age=31556952',
									'content-encoding': contentEncoding,
									'content-type': mimeType,
								})
								.end(body)
						} catch (err) {
							res.statusCode = 404
							res.end('File not found')
						}
					}
				} else {
					next()
				}
			})
	}

	app
		.use(function (req, res, next) {
			if (!_InitEnv.PROCESS_ENV.BASE_URL)
				_InitEnv.PROCESS_ENV.BASE_URL = `${req.protocol}://${req.hostname}`
			next()
		})
		.use(function (req, res, next) {
			const botInfo =
				req.headers['botinfo'] ||
				req.headers['botInfo'] ||
				JSON.stringify(_DetectBot2.default.call(void 0, req))

			_CookieHandler.setCookie.call(
				void 0,
				res,
				`BotInfo=${botInfo};Max-Age=${COOKIE_EXPIRED_SECOND};Path=/`
			)

			next()
		})
		.use(function (req, res, next) {
			const localeInfo = (() => {
				let tmpLocaleInfo =
					req.headers['localeinfo'] || req.headers['localeInfo']

				if (tmpLocaleInfo) return JSON.parse(tmpLocaleInfo)

				return _DetectLocale2.default.call(void 0, req)
			})()

			const enableLocale =
				_serverconfig2.default.locale.enable &&
				Boolean(
					!_serverconfig2.default.locale.routes ||
						!_serverconfig2.default.locale.routes[req.url] ||
						_serverconfig2.default.locale.routes[req.url].enable
				)

			_CookieHandler.setCookie.call(
				void 0,
				res,
				`LocaleInfo=${JSON.stringify(
					localeInfo
				)};Max-Age=${COOKIE_EXPIRED_SECOND};Path=/`
			)

			if (enableLocale) {
				_CookieHandler.setCookie.call(
					void 0,
					res,
					`lang=${_nullishCoalesce(
						_optionalChain([
							localeInfo,
							'optionalAccess',
							(_) => _.langSelected,
						]),
						() => _serverconfig2.default.locale.defaultLang
					)};Path=/`
				)

				if (_serverconfig2.default.locale.defaultCountry) {
					_CookieHandler.setCookie.call(
						void 0,
						res,
						`country=${_nullishCoalesce(
							_optionalChain([
								localeInfo,
								'optionalAccess',
								(_2) => _2.countrySelected,
							]),
							() => _serverconfig2.default.locale.defaultCountry
						)};Path=/`
					)
				}
			}
			next()
		})
	if (!_InitEnv.PROCESS_ENV.IS_REMOTE_CRAWLER) {
		app.use(function (req, res, next) {
			const redirectResult = _DetectRedirect2.default.call(void 0, req, res)

			if (redirectResult.status !== 200) {
				if (req.headers.accept === 'application/json') {
					req.headers['redirect'] = JSON.stringify(redirectResult)
				} else {
					if (redirectResult.path.length > 1)
						redirectResult.path = redirectResult.path.replace(
							/\/$|\/(\?)/,
							'$1'
						)
					res.writeHead(redirectResult.status, {
						Location: `${redirectResult.path}${
							redirectResult.search ? redirectResult.search : ''
						}`,
						'cache-control': 'no-store',
					})
					return res.end()
				}
			}
			next()
		})
	}
	app
		.use(function (req, res, next) {
			const environmentInfo = (() => {
				const tmpEnvironmentInfo =
					req.headers['environmentinfo'] || req.headers['environmentInfo']

				if (tmpEnvironmentInfo) return tmpEnvironmentInfo

				return JSON.stringify({
					ENV: _InitEnv.ENV,
					MODE: _InitEnv.MODE,
					ENV_MODE: _InitEnv.ENV_MODE,
				})
			})()
			_CookieHandler.setCookie.call(
				void 0,
				res,
				`EnvironmentInfo=${environmentInfo};Max-Age=${COOKIE_EXPIRED_SECOND};Path=/`
			)
			next()
		})
		.use(function (req, res, next) {
			const deviceInfo =
				req.headers['deviceinfo'] ||
				req.headers['deviceInfo'] ||
				JSON.stringify(_DetectDevice2.default.call(void 0, req))

			_CookieHandler.setCookie.call(
				void 0,
				res,
				`DeviceInfo=${deviceInfo};Max-Age=${COOKIE_EXPIRED_SECOND};Path=/`
			)

			next()
		})
	;(await require('./puppeteer-ssr/index.fastify').default).init(app)

	app.listen(
		{
			port,
		},
		() => {
			console.log(`Server started port ${port}. Press Ctrl+C to quit`)
			_optionalChain([
				process,
				'access',
				(_3) => _3.send,
				'optionalCall',
				(_4) => _4('ready'),
			])
		}
	)

	process.on('SIGINT', async function () {
		await app.close()
		process.exit(0)
	})

	if (!_InitEnv.PROCESS_ENV.IS_REMOTE_CRAWLER) {
		if (_InitEnv.ENV === 'development') {
			// NOTE - restart server onchange
			// const watcher = chokidar.watch([path.resolve(__dirname, './**/*.ts')], {
			// 	ignored: /$^/,
			// 	persistent: true,
			// })

			if (!_InitEnv.PROCESS_ENV.REFRESH_SERVER) {
				if (_InitEnv.PROCESS_ENV.BUILD_TOOL === 'vite')
					_child_process.spawn.call(void 0, 'vite', [], {
						stdio: 'inherit',
						shell: true,
					})
				else if (_InitEnv.PROCESS_ENV.BUILD_TOOL === 'webpack')
					_child_process.spawn.call(
						void 0,
						'cross-env',
						['PORT=3000 IO_PORT=3030 npx webpack serve --mode=development'],
						{
							stdio: 'inherit',
							shell: true,
						}
					)
			}

			// watcher.on('change', async (path) => {
			// 	Console.log(`File ${path} has been changed`)
			// 	await app.close()
			// 	setTimeout(() => {
			// 		spawn(
			// 			'node',
			// 			[
			// 				'cross-env REFRESH_SERVER=1 --require sucrase/register server/src/index.ts',
			// 			],
			// 			{
			// 				stdio: 'inherit',
			// 				shell: true,
			// 			}
			// 		)
			// 	})
			// 	process.exit(0)
			// })
		} else if (!_InitEnv.PROCESS_ENV.IS_SERVER) {
			if (_InitEnv.PROCESS_ENV.BUILD_TOOL === 'vite')
				_child_process.spawn.call(void 0, 'vite', ['preview'], {
					stdio: 'inherit',
					shell: true,
				})
			else if (_InitEnv.PROCESS_ENV.BUILD_TOOL === 'webpack')
				_child_process.spawn.call(
					void 0,
					'cross-env',
					[
						'PORT=1234 NODE_NO_WARNINGS=1 node ./config/webpack.serve.config.js',
					],
					{
						stdio: 'inherit',
						shell: true,
					}
				)
		}
	}
}

startServer()

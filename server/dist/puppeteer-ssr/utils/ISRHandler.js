"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; } function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } } async function _asyncNullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return await rhsFn(); } } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }var _path = require('path'); var _path2 = _interopRequireDefault(_path);








var _constants = require('../../constants');
var _serverconfig = require('../../server.config'); var _serverconfig2 = _interopRequireDefault(_serverconfig);
var _ConsoleHandler = require('../../utils/ConsoleHandler'); var _ConsoleHandler2 = _interopRequireDefault(_ConsoleHandler);
var _InitEnv = require('../../utils/InitEnv');
var _WorkerManager = require('../../utils/WorkerManager'); var _WorkerManager2 = _interopRequireDefault(_WorkerManager);





var _constants3 = require('../constants');

var _BrowserManager = require('./BrowserManager'); var _BrowserManager2 = _interopRequireDefault(_BrowserManager);
var _CacheManager = require('./CacheManager'); var _CacheManager2 = _interopRequireDefault(_CacheManager);

const workerManager = _WorkerManager2.default.init(
	_path2.default.resolve(__dirname + `/OptimizeHtml.worker.${_constants.resourceExtension}`),
	{ minWorkers: 1, maxWorkers: 4 },
	['optimizeContent', 'compressContent']
)

const browserManager = (() => {
	if (_InitEnv.ENV_MODE === 'development') return undefined 
	if (_constants.POWER_LEVEL === _constants.POWER_LEVEL_LIST.THREE)
		return _BrowserManager2.default.call(void 0, () => `${_constants.userDataPath}/user_data_${Date.now()}`)
	return _BrowserManager2.default.call(void 0, )
})()







const _getRestOfDuration = (startGenerating, gapDuration = 0) => {
	if (!startGenerating) return 0

	return _constants3.DURATION_TIMEOUT - gapDuration - (Date.now() - startGenerating)
} // _getRestOfDuration

const _getSafePage = (page) => {
	const SafePage = page

	return () => {
		if (SafePage && SafePage.isClosed()) return
		return SafePage
	}
} // _getSafePage

const fetchData = async (
	input,
	init,
	reqData
) => {
	try {
		const params = new URLSearchParams()
		if (reqData) {
			for (const key in reqData) {
				params.append(key, reqData[key])
			}
		}

		const response = await fetch(
			input + (reqData ? `?${params.toString()}` : ''),
			init
		).then(async (res) => ({
			status: res.status,
			data: await res.text(),
		}))

		const data = /^{(.|[\r\n])*?}$/.test(response.data)
			? JSON.parse(response.data)
			: response.data

		return {
			...response,
			data,
		}
	} catch (error) {
		_ConsoleHandler2.default.error(error)
		return {
			status: 500,
			data: '',
		}
	}
} // fetchData

const waitResponse = (() => {
	const firstWaitingDuration =
		_constants.BANDWIDTH_LEVEL > _constants.BANDWIDTH_LEVEL_LIST.ONE ? 100 : 500
	const defaultRequestWaitingDuration =
		_constants.BANDWIDTH_LEVEL > _constants.BANDWIDTH_LEVEL_LIST.ONE ? 100 : 500
	const requestServedFromCacheDuration =
		_constants.BANDWIDTH_LEVEL > _constants.BANDWIDTH_LEVEL_LIST.ONE ? 100 : 250
	const requestFailDuration =
		_constants.BANDWIDTH_LEVEL > _constants.BANDWIDTH_LEVEL_LIST.ONE ? 100 : 250
	const maximumTimeout =
		_constants.BANDWIDTH_LEVEL > _constants.BANDWIDTH_LEVEL_LIST.ONE ? 60000 : 60000

	return async (page, url, duration) => {
		let hasRedirected = false
		const safePage = _getSafePage(page)
		_optionalChain([safePage, 'call', _ => _(), 'optionalAccess', _2 => _2.on, 'call', _3 => _3('response', (response) => {
			const status = response.status()
			//[301, 302, 303, 307, 308]
			if (status >= 300 && status <= 399) {
				hasRedirected = true
			}
		})])

		let response
		try {
			response = await new Promise(async (resolve, reject) => {
				const result = await new Promise((resolveAfterPageLoad) => {
					_optionalChain([safePage, 'call', _4 => _4()
, 'optionalAccess', _5 => _5.goto, 'call', _6 => _6(url.split('?')[0], {
							// waitUntil: 'networkidle2',
							waitUntil: 'load',
							timeout: 0,
						})
, 'access', _7 => _7.then, 'call', _8 => _8((res) => {
							setTimeout(() => resolveAfterPageLoad(res), firstWaitingDuration)
						})
, 'access', _9 => _9.catch, 'call', _10 => _10((err) => {
							reject(err)
						})])
				})

				const waitForNavigate = async () => {
					if (hasRedirected) {
						hasRedirected = false
						await _optionalChain([safePage, 'call', _11 => _11(), 'optionalAccess', _12 => _12.waitForSelector, 'call', _13 => _13('body')])
						await waitForNavigate()
					}
				}

				await waitForNavigate()

				_optionalChain([safePage, 'call', _14 => _14(), 'optionalAccess', _15 => _15.removeAllListeners, 'call', _16 => _16('response')])

				const html = await _asyncNullishCoalesce((await _optionalChain([safePage, 'call', _17 => _17(), 'optionalAccess', _18 => _18.content, 'call', _19 => _19()])), async () => ( ''))

				if (_constants3.regexNotFoundPageID.test(html)) return resolve(result)

				await new Promise((resolveAfterPageLoadInFewSecond) => {
					const startTimeout = (() => {
						let timeout
						return (duration = defaultRequestWaitingDuration) => {
							if (timeout) clearTimeout(timeout)
							timeout = setTimeout(resolveAfterPageLoadInFewSecond, duration)
						}
					})()

					startTimeout()

					_optionalChain([safePage, 'call', _20 => _20(), 'optionalAccess', _21 => _21.on, 'call', _22 => _22('requestfinished', () => {
						startTimeout()
					})])
					_optionalChain([safePage, 'call', _23 => _23(), 'optionalAccess', _24 => _24.on, 'call', _25 => _25('requestservedfromcache', () => {
						startTimeout(requestServedFromCacheDuration)
					})])
					_optionalChain([safePage, 'call', _26 => _26(), 'optionalAccess', _27 => _27.on, 'call', _28 => _28('requestfailed', () => {
						startTimeout(requestFailDuration)
					})])

					setTimeout(resolveAfterPageLoadInFewSecond, maximumTimeout)
				})

				setTimeout(() => {
					resolve(result)
				}, 100)
			})
		} catch (err) {
			_ConsoleHandler2.default.log('ISRHandler line 156:')
			throw err
		}

		return response
	}
})() // waitResponse

const gapDurationDefault = 1500

const ISRHandler = async ({ hasCache, url }) => {
	const startGenerating = Date.now()
	if (_getRestOfDuration(startGenerating, gapDurationDefault) <= 0) return

	const cacheManager = _CacheManager2.default.call(void 0, url)

	let restOfDuration = _getRestOfDuration(startGenerating, gapDurationDefault)

	if (restOfDuration <= 0) {
		if (hasCache) {
			const tmpResult = await cacheManager.achieve()

			return tmpResult
		}
		return
	}

	let html = ''
	let status = 200
	let enableOptimizeAndCompressIfRemoteCrawlerFail = !_serverconfig2.default.crawler

	const specialInfo = _nullishCoalesce(_optionalChain([_constants3.regexQueryStringSpecialInfo, 'access', _29 => _29.exec, 'call', _30 => _30(url), 'optionalAccess', _31 => _31.groups]), () => ( {}))

	if (_serverconfig2.default.crawler) {
		const requestParams = {
			startGenerating,
			hasCache,
			url: url.split('?')[0],
		}

		if (_serverconfig2.default.crawlerSecretKey) {
			requestParams['crawlerSecretKey'] = _serverconfig2.default.crawlerSecretKey
		}

		const headers = { ...specialInfo }

		const botInfo = JSON.parse(headers['botInfo'])

		if (!botInfo.isBot) {
			headers['botInfo'] = JSON.stringify({
				name: 'unknown',
				isBot: true,
			})
		}

		try {
			const result = await fetchData(
				_serverconfig2.default.crawler,
				{
					method: 'GET',
					headers: new Headers({
						Accept: 'text/html; charset=utf-8',
						...headers,
					}),
				},
				requestParams
			)

			if (result) {
				status = result.status
				html = result.data
			}
			_ConsoleHandler2.default.log('External crawler status: ', status)
		} catch (err) {
			enableOptimizeAndCompressIfRemoteCrawlerFail = true
			_ConsoleHandler2.default.log('ISRHandler line 230:')
			_ConsoleHandler2.default.log('Crawler is fail!')
			_ConsoleHandler2.default.error(err)
		}
	}

	if (!_serverconfig2.default.crawler || [404, 500].includes(status)) {
		enableOptimizeAndCompressIfRemoteCrawlerFail = true
		_ConsoleHandler2.default.log('Create new page')
		const page = await browserManager.newPage()
		const safePage = _getSafePage(page)

		_ConsoleHandler2.default.log('Create new page success!')

		if (!page) {
			if (!page && hasCache) {
				const tmpResult = await cacheManager.achieve()

				return tmpResult
			}
			return
		}

		let isGetHtmlProcessError = false

		try {
			await _optionalChain([safePage, 'call', _32 => _32(), 'optionalAccess', _33 => _33.waitForNetworkIdle, 'call', _34 => _34({ idleTime: 150 })])
			await _optionalChain([safePage, 'call', _35 => _35(), 'optionalAccess', _36 => _36.setRequestInterception, 'call', _37 => _37(true)])
			_optionalChain([safePage, 'call', _38 => _38(), 'optionalAccess', _39 => _39.on, 'call', _40 => _40('request', (req) => {
				const resourceType = req.resourceType()

				if (resourceType === 'stylesheet') {
					req.respond({ status: 200, body: 'aborted' })
				} else if (
					/(socket.io.min.js)+(?:$)|data:image\/[a-z]*.?\;base64/.test(url) ||
					/googletagmanager.com|connect.facebook.net|asia.creativecdn.com|static.hotjar.com|deqik.com|contineljs.com|googleads.g.doubleclick.net|analytics.tiktok.com|google.com|gstatic.com|static.airbridge.io|googleadservices.com|google-analytics.com|sg.mmstat.com|t.contentsquare.net|accounts.google.com|browser.sentry-cdn.com|bat.bing.com|tr.snapchat.com|ct.pinterest.com|criteo.com|webchat.caresoft.vn|tags.creativecdn.com|script.crazyegg.com|tags.tiqcdn.com|trc.taboola.com|securepubads.g.doubleclick.net/.test(
						req.url()
					) ||
					['font', 'image', 'media', 'imageset'].includes(resourceType)
				) {
					req.abort()
				} else {
					req.continue()
				}
			})])

			await _optionalChain([safePage, 'call', _41 => _41(), 'optionalAccess', _42 => _42.setExtraHTTPHeaders, 'call', _43 => _43({
				...specialInfo,
				service: 'puppeteer',
			})])

			await new Promise(async (res) => {
				_ConsoleHandler2.default.log(`Start to crawl: ${url}`)

				let response

				try {
					response = await waitResponse(page, url, restOfDuration)
				} catch (err) {
					if (err.name !== 'TimeoutError') {
						isGetHtmlProcessError = true
						_ConsoleHandler2.default.log('ISRHandler line 285:')
						_ConsoleHandler2.default.error(err)
						_optionalChain([safePage, 'call', _44 => _44(), 'optionalAccess', _45 => _45.close, 'call', _46 => _46()])
						return res(false)
					}
				} finally {
					status = _nullishCoalesce(_optionalChain([response, 'optionalAccess', _47 => _47.status, 'optionalCall', _48 => _48()]), () => ( status))
					_ConsoleHandler2.default.log(`Internal crawler status: ${status}`)

					res(true)
				}
			})
		} catch (err) {
			_ConsoleHandler2.default.log('ISRHandler line 297:')
			_ConsoleHandler2.default.log('Crawler is fail!')
			_ConsoleHandler2.default.error(err)
			cacheManager.remove(url)
			_optionalChain([safePage, 'call', _49 => _49(), 'optionalAccess', _50 => _50.close, 'call', _51 => _51()])
			return {
				status: 500,
			}
		}

		if (isGetHtmlProcessError) {
			cacheManager.remove(url)
			return {
				status: 500,
			}
		}

		try {
			html = await _asyncNullishCoalesce((await _optionalChain([safePage, 'call', _52 => _52(), 'optionalAccess', _53 => _53.content, 'call', _54 => _54()])), async () => ( '')) // serialized HTML of page DOM.
			_optionalChain([safePage, 'call', _55 => _55(), 'optionalAccess', _56 => _56.close, 'call', _57 => _57()])
		} catch (err) {
			_ConsoleHandler2.default.log('ISRHandler line 315:')
			_ConsoleHandler2.default.error(err)
			return
		}

		status = html && _constants3.regexNotFoundPageID.test(html) ? 404 : 200
	}

	restOfDuration = _getRestOfDuration(startGenerating)

	let result
	if (_constants3.CACHEABLE_STATUS_CODE[status]) {
		const pathname = new URL(url).pathname
		const enableToOptimize =
			(_optionalChain([_serverconfig2.default, 'access', _58 => _58.crawl, 'access', _59 => _59.routes, 'access', _60 => _60[pathname], 'optionalAccess', _61 => _61.optimize]) ||
				_optionalChain([_serverconfig2.default, 'access', _62 => _62.crawl, 'access', _63 => _63.custom, 'optionalCall', _64 => _64(pathname), 'optionalAccess', _65 => _65.optimize]) ||
				_serverconfig2.default.crawl.optimize) &&
			enableOptimizeAndCompressIfRemoteCrawlerFail

		const enableToCompress =
			(_optionalChain([_serverconfig2.default, 'access', _66 => _66.crawl, 'access', _67 => _67.routes, 'access', _68 => _68[pathname], 'optionalAccess', _69 => _69.compress]) ||
				_optionalChain([_serverconfig2.default, 'access', _70 => _70.crawl, 'access', _71 => _71.custom, 'optionalCall', _72 => _72(pathname), 'optionalAccess', _73 => _73.compress]) ||
				_serverconfig2.default.crawl.compress) &&
			enableOptimizeAndCompressIfRemoteCrawlerFail

		// let optimizeHTMLContentPool

		let isRaw = false

		const freePool = workerManager.getFreePool()
		const pool = freePool.pool

		try {
			if (enableToOptimize)
				html = await pool.exec('optimizeContent', [
					html,
					true,
					enableToOptimize,
				])

			if (enableToCompress)
				html = await pool.exec('compressContent', [html, enableToCompress])
		} catch (err) {
			isRaw = true
			_ConsoleHandler2.default.log('--------------------')
			_ConsoleHandler2.default.log('ISRHandler line 368:')
			_ConsoleHandler2.default.log('error url', url.split('?')[0])
			_ConsoleHandler2.default.error(err)
		} finally {
			freePool.terminate()
		}

		result = await cacheManager.set({
			html,
			url,
			isRaw,
		})
	} else {
		cacheManager.remove(url)
		return {
			status,
			html: status === 404 ? 'Page not found!' : html,
		}
	}

	return result
}

exports. default = ISRHandler

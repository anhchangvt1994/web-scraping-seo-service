"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; } function _nullishCoalesce(lhs, rhsFn) { if (lhs != null) { return lhs; } else { return rhsFn(); } } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }
var _workerpool = require('workerpool'); var _workerpool2 = _interopRequireDefault(_workerpool);








var _constants = require('../../constants');
var _serverconfig = require('../../server.config'); var _serverconfig2 = _interopRequireDefault(_serverconfig);
var _ConsoleHandler = require('../../utils/ConsoleHandler'); var _ConsoleHandler2 = _interopRequireDefault(_ConsoleHandler);






var _constants3 = require('../constants');

var _BrowserManager = require('./BrowserManager'); var _BrowserManager2 = _interopRequireDefault(_BrowserManager);
var _CacheManager = require('./CacheManager'); var _CacheManager2 = _interopRequireDefault(_CacheManager);
var _store = require('../../store');

const browserManager = (() => {
	if (_constants.ENV_MODE === 'development') return undefined 
	if (_constants.POWER_LEVEL === _constants.POWER_LEVEL_LIST.THREE)
		return _BrowserManager2.default.call(void 0, () => `${_constants.userDataPath}/user_data_${Date.now()}`)
	return _BrowserManager2.default.call(void 0, )
})()







const getRestOfDuration = (startGenerating, gapDuration = 0) => {
	if (!startGenerating) return 0

	return _constants3.DURATION_TIMEOUT - gapDuration - (Date.now() - startGenerating)
} // getRestOfDuration

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
		_constants.BANDWIDTH_LEVEL > _constants.BANDWIDTH_LEVEL_LIST.ONE ? 200 : 500
	const defaultRequestWaitingDuration =
		_constants.BANDWIDTH_LEVEL > _constants.BANDWIDTH_LEVEL_LIST.ONE ? 200 : 500
	const requestServedFromCacheDuration =
		_constants.BANDWIDTH_LEVEL > _constants.BANDWIDTH_LEVEL_LIST.ONE ? 200 : 250
	const requestFailDuration =
		_constants.BANDWIDTH_LEVEL > _constants.BANDWIDTH_LEVEL_LIST.ONE ? 200 : 250
	const maximumTimeout =
		_constants.BANDWIDTH_LEVEL > _constants.BANDWIDTH_LEVEL_LIST.ONE ? 5000 : 5000

	return async (page, url, duration) => {
		let response
		try {
			response = await new Promise(async (resolve, reject) => {
				const result = await new Promise((resolveAfterPageLoad) => {
					page
						.goto(url.split('?')[0], {
							waitUntil: 'domcontentloaded',
						})
						.then((res) => {
							setTimeout(() => resolveAfterPageLoad(res), firstWaitingDuration)
						})
						.catch((err) => {
							reject(err)
						})
				})

				const html = await page.content()

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

					page.on('requestfinished', () => {
						startTimeout()
					})
					page.on('requestservedfromcache', () => {
						startTimeout(requestServedFromCacheDuration)
					})
					page.on('requestfailed', () => {
						startTimeout(requestFailDuration)
					})

					setTimeout(resolveAfterPageLoadInFewSecond, maximumTimeout)
				})

				resolve(result)
			})
		} catch (err) {
			throw err
		}

		return response
	}
})() // waitResponse

const gapDurationDefault = 1500

const ISRHandler = async ({ isFirstRequest, url }) => {
	const startGenerating = Date.now()
	if (getRestOfDuration(startGenerating, gapDurationDefault) <= 0) return

	const cacheManager = _CacheManager2.default.call(void 0, )

	let restOfDuration = getRestOfDuration(startGenerating, gapDurationDefault)

	if (restOfDuration <= 0) {
		if (!isFirstRequest) {
			const tmpResult = await cacheManager.achieve(url)

			return tmpResult
		}
		return
	}

	let html = ''
	let status = 200

	if (_serverconfig2.default.crawler) {
		const requestParams = {
			startGenerating,
			isFirstRequest: true,
			url,
		}

		if (_serverconfig2.default.crawlerSecretKey) {
			requestParams['crawlerSecretKey'] = _serverconfig2.default.crawlerSecretKey
		}

		const headersStore = _store.getStore.call(void 0, 'headers')

		try {
			const result = await fetchData(
				_serverconfig2.default.crawler,
				{
					method: 'GET',
					headers: new Headers({
						Accept: 'text/html; charset=utf-8',
						...headersStore,
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
			_ConsoleHandler2.default.log('Crawler is fail!')
			_ConsoleHandler2.default.error(err)
		}
	}

	if (!_serverconfig2.default.crawler || [404, 500].includes(status)) {
		_ConsoleHandler2.default.log('Create new page')
		const page = await browserManager.newPage()
		_ConsoleHandler2.default.log('Create new page success!')

		if (!page) {
			if (!page && !isFirstRequest) {
				const tmpResult = await cacheManager.achieve(url)

				return tmpResult
			}
			return
		}

		let isGetHtmlProcessError = false

		try {
			await page.waitForNetworkIdle({ idleTime: 150 })
			await page.setRequestInterception(true)
			page.on('request', (req) => {
				const resourceType = req.resourceType()

				if (resourceType === 'stylesheet') {
					req.respond({ status: 200, body: 'aborted' })
				} else if (
					/(socket.io.min.js)+(?:$)|data:image\/[a-z]*.?\;base64/.test(url) ||
					/font|image|media|imageset/.test(resourceType)
				) {
					req.abort()
				} else {
					req.continue()
				}
			})

			const specialInfo = _nullishCoalesce(_optionalChain([_constants3.regexQueryStringSpecialInfo, 'access', _ => _.exec, 'call', _2 => _2(url), 'optionalAccess', _3 => _3.groups]), () => ( {}))

			await page.setExtraHTTPHeaders({
				...specialInfo,
				service: 'puppeteer',
			})

			await new Promise(async (res) => {
				_ConsoleHandler2.default.log(`Start to crawl: ${url}`)

				let response

				try {
					response = await waitResponse(page, url, restOfDuration)
				} catch (err) {
					if (err.name !== 'TimeoutError') {
						isGetHtmlProcessError = true
						res(false)
						await page.close()
						return _ConsoleHandler2.default.error(err)
					}
				} finally {
					status = _nullishCoalesce(_optionalChain([response, 'optionalAccess', _4 => _4.status, 'optionalCall', _5 => _5()]), () => ( status))
					_ConsoleHandler2.default.log(`Internal crawler status: ${status}`)

					res(true)
				}
			})
		} catch (err) {
			_ConsoleHandler2.default.log('Crawler is fail!')
			_ConsoleHandler2.default.error(err)
			await page.close()
			return {
				status: 500,
			}
		}

		if (isGetHtmlProcessError)
			return {
				status: 500,
			}

		try {
			html = await page.content() // serialized HTML of page DOM.
			await page.close()
		} catch (err) {
			_ConsoleHandler2.default.error(err)
			return
		}

		status = html && _constants3.regexNotFoundPageID.test(html) ? 404 : 200
	}

	restOfDuration = getRestOfDuration(startGenerating)

	let result
	if (_constants3.CACHEABLE_STATUS_CODE[status]) {
		const optimizeHTMLContentPool = _workerpool2.default.pool(
			__dirname + `/OptimizeHtml.worker.${_constants.resourceExtension}`,
			{
				minWorkers: 2,
				maxWorkers: _constants3.MAX_WORKERS,
			}
		)

		try {
			html = await optimizeHTMLContentPool.exec('optimizeContent', [html, true])
		} catch (err) {
			_ConsoleHandler2.default.error(err)
			return
		} finally {
			optimizeHTMLContentPool.terminate()
		}

		result = await cacheManager.set({
			html,
			url,
			isRaw: true,
		})
	} else {
		await cacheManager.remove(url)
		return {
			status,
			html: status === 404 ? 'Page not found!' : html,
		}
	}

	return result
}

exports. default = ISRHandler

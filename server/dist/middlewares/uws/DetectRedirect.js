"use strict";Object.defineProperty(exports, "__esModule", {value: true}); function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }
var _constants = require('../../constants');
var _DetectRedirectuws = require('../../utils/DetectRedirect.uws'); var _DetectRedirectuws2 = _interopRequireDefault(_DetectRedirectuws);
var _InitEnv = require('../../utils/InitEnv');

const COOKIE_EXPIRED_SECOND = _constants.COOKIE_EXPIRED / 1000

const DetectRedirectMiddle = (res, req) => {
	if (_InitEnv.PROCESS_ENV.IS_REMOTE_CRAWLER) return false
	const redirectResult = _DetectRedirectuws2.default.call(void 0, req, res)
	const isRedirect = redirectResult.status !== 200
	res.urlForCrawler = req.getUrl()

	if (isRedirect) {
		if (req.getHeader('accept') === 'application/json') {
			res.urlForCrawler = redirectResult.path
			res
				.writeHeader(
					'set-cookie',
					`LocaleInfo=${JSON.stringify(
						res.cookies.localeInfo
					)};Max-Age=${COOKIE_EXPIRED_SECOND};Path=/`
				)
				.writeHeader('Cache-Control', 'no-store')
				.end(JSON.stringify(redirectResult), true)
		} else {
			if (redirectResult.path.length > 1)
				redirectResult.path = redirectResult.path.replace(/\/$|\/(\?)/, '$1')
			res
				.writeStatus(String(redirectResult.status))
				.writeHeader(
					'Location',
					`${redirectResult.path}${
						redirectResult.search ? redirectResult.search : ''
					}`
				)
				.writeHeader('cache-control', 'no-store')
				.end('', true)
		}

		res.writableEnded = true
	}

	return isRedirect
}

exports. default = DetectRedirectMiddle

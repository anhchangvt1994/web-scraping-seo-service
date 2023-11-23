import puppeteerSSRService from './puppeteer-ssr/index.uws'

require('events').EventEmitter.setMaxListeners(200)

const port = process.env.PORT || 3000
const app = require('uWebSockets.js')./*SSL*/ App({
	key_file_name: 'misc/key.pem',
	cert_file_name: 'misc/cert.pem',
	passphrase: '1234',
})

puppeteerSSRService.init(app)

app.listen(Number(port), (token) => {
	if (token) {
		console.log(`Server started port ${port}. Press Ctrl+C to quit`)
		process.send?.('ready')
	} else {
		console.log(`Failed to listen to port ${port}`)
	}
})

process.on('SIGINT', async function () {
	await app.close()
	process.exit(0)
})

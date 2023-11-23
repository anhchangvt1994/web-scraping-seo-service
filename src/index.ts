import express from 'express'
import puppeteerSSRService from './puppeteer-ssr'

require('events').EventEmitter.setMaxListeners(200)

const port = process.env.PORT || 3000
const app = express()
const server = require('http').createServer(app)

puppeteerSSRService.init(app)

server.listen(port, () => {
	console.log(`Server started port ${port}. Press Ctrl+C to quit`)
	process.send?.('ready')
})

process.on('SIGINT', async function () {
	await server.close()
	process.exit(0)
})

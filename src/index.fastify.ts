import fastify from 'fastify'
import puppeteerSSRService from './puppeteer-ssr/index.fastify'

const port = (process.env.PORT || 3000) as number

const app = fastify()

puppeteerSSRService.init(app)

app.listen(
	{
		port,
	},
	() => {
		console.log(`Server started port ${port}. Press Ctrl+C to quit`)
		process.send?.('ready')
	}
)

process.on('SIGINT', async function () {
	await app.close()
	process.exit(0)
})
import Chromium from '@sparticuz/chromium-min'
import path from 'path'
import { Browser, Page } from 'puppeteer-core'
import WorkerPool from 'workerpool'
import {
	POWER_LEVEL,
	POWER_LEVEL_LIST,
	SERVER_LESS,
	resourceExtension,
	userDataPath,
} from '../../constants'
import { getStore, setStore } from '../../store'
import Console from '../../utils/ConsoleHandler'
import {
	canUseLinuxChromium,
	chromiumPath,
	defaultBrowserOptions,
	puppeteer,
} from '../constants'

export interface IBrowser {
	get: () => Promise<Browser | undefined>
	newPage: () => Promise<Page | undefined>
	isReady: () => boolean
}

export const deleteUserDataDir = async (dir: string) => {
	if (dir) {
		try {
			await WorkerPool.pool(
				path.resolve(
					__dirname,
					`./FollowResource.worker/index.${resourceExtension}`
				)
			)?.exec('deleteResource', [dir])
		} catch (err) {
			Console.error(err)
		}
	}
} // deleteUserDataDir

const BrowserManager = (
	userDataDir: () => string = () => `${userDataPath}/user_data`
): IBrowser => {
	const maxRequestPerBrowser = 20
	let totalRequests = 0
	let browserLaunch: Promise<Browser | undefined>
	let reserveUserDataDirPath: string
	let executablePath: string

	const __launch = async () => {
		totalRequests = 0

		const selfUserDataDirPath = reserveUserDataDirPath || userDataDir()
		reserveUserDataDirPath = `${userDataDir()}_reserve`

		browserLaunch = new Promise(async (res, rej) => {
			let isError = false
			let promiseBrowser
			const browserStore = (() => {
				const tmpBrowserStore = getStore('browser')
				return tmpBrowserStore || {}
			})()
			const promiseStore = (() => {
				const tmpPromiseStore = getStore('promise')
				return tmpPromiseStore || {}
			})()

			try {
				if (canUseLinuxChromium && !promiseStore.executablePath) {
					Console.log('Create executablePath')
					promiseStore.executablePath = Chromium.executablePath(chromiumPath)
				}

				browserStore.userDataPath = selfUserDataDirPath
				browserStore.reserveUserDataPath = reserveUserDataDirPath

				setStore('browser', browserStore)
				setStore('promise', promiseStore)

				if (!executablePath && promiseStore.executablePath) {
					executablePath = await promiseStore.executablePath
				}

				if (promiseStore.executablePath) {
					Console.log('Start browser with executablePath')
					promiseBrowser = puppeteer.launch({
						...defaultBrowserOptions,
						userDataDir: selfUserDataDirPath,
						args: Chromium.args,
						executablePath,
					})

					// NOTE - Create a preventive browser to replace when current browser expired
					new Promise(async (res) => {
						const reserveBrowser = await puppeteer.launch({
							...defaultBrowserOptions,
							userDataDir: reserveUserDataDirPath,
							args: Chromium.args,
							executablePath,
						})
						reserveBrowser.close()
						res(null)
					})
				} else {
					Console.log('Start browser without executablePath')
					promiseBrowser = puppeteer.launch({
						...defaultBrowserOptions,
						userDataDir: selfUserDataDirPath,
					})

					// NOTE - Create a preventive browser to replace when current browser expired
					new Promise(async (res) => {
						const reserveBrowser = await puppeteer.launch({
							...defaultBrowserOptions,
							userDataDir: reserveUserDataDirPath,
						})
						reserveBrowser.close()
						res(null)
					})
				}
			} catch (err) {
				isError = true
				Console.error(err)
			} finally {
				if (isError) return rej(undefined)
				Console.log('Start browser success!')
				res(promiseBrowser)
			}
		})

		if (browserLaunch) {
			try {
				let tabsClosed = 0
				const browser: Browser = (await browserLaunch) as Browser

				browser.on('createNewPage', (async (page: Page) => {
					await new Promise((resolveCloseTab) => {
						const timeoutCloseTab = setTimeout(() => {
							if (!page.isClosed()) {
								page.close({
									runBeforeUnload: true,
								})
							}
							resolveCloseTab(null)
						}, 180000)
						page.once('close', () => {
							clearTimeout(timeoutCloseTab)
							resolveCloseTab(null)
						})
					})

					tabsClosed++

					if (!SERVER_LESS && tabsClosed === 20) {
						browser.close()
						__launch()
						deleteUserDataDir(selfUserDataDirPath)
					}
				}) as any)
			} catch (err) {
				Console.error(err)
			}
		}
	} // __launch()

	if (POWER_LEVEL === POWER_LEVEL_LIST.THREE) {
		__launch()
	}

	const _get = async () => {
		if (!browserLaunch || !_isReady()) {
			__launch()
		}

		totalRequests++
		const curBrowserLaunch = browserLaunch

		const pages = (await (await curBrowserLaunch)?.pages())?.length ?? 0
		await new Promise((res) => setTimeout(res, pages * 20))

		return curBrowserLaunch as Promise<Browser>
	} // _get

	const _newPage = async () => {
		let browser
		let page
		try {
			browser = await _get()
			page = await browser?.newPage?.()

			if (!page) {
				__launch()
				return _newPage()
			}
		} catch (err) {
			__launch()
			return _newPage()
		}

		if (page) browser.emit('createNewPage', page)
		return page
	} // _newPage

	const _isReady = () => {
		return totalRequests <= maxRequestPerBrowser
	} // _isReady

	return {
		get: _get,
		newPage: _newPage,
		isReady: _isReady,
	}
}

export default BrowserManager

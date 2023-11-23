import { ENV } from '../../constants'
import { defaultServerConfig } from './constants'
import { IServerConfig, IServerConfigOptional } from './types'

export const defineServerConfig = (options: IServerConfigOptional) => {
	const serverConfigDefined = { ...options } as IServerConfig

	for (const key in defaultServerConfig) {}

	serverConfigDefined.crawlerSecretKey =
				ENV === 'development'
					? serverConfigDefined['crawlerSecretKey']
					: process.env.CRAWLER_SECRET_KEY || undefined

	return serverConfigDefined as IServerConfig
}

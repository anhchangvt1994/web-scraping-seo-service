import { Response } from "express";
import { IBotInfo } from "../../types";
import { getCookieFromResponse } from "../../utils/CookieHandler";
import { PROCESS_ENV } from "../../utils/InitEnv";
import ServerConfig from "../../server.config";

export const convertUrlHeaderToQueryString = (
  url: string,
  res: Response,
  simulateBot: boolean = false
) => {
  if (!url) return "";

  const cookies = getCookieFromResponse(res);
  let botInfoStringify;

  if (simulateBot) {
    botInfoStringify = JSON.stringify({
      isBot: true,
      name: "puppeteer-ssr",
    } as IBotInfo);
  } else {
    botInfoStringify = JSON.stringify(cookies?.["BotInfo"]);
  }

  const deviceInfoStringify = JSON.stringify({
    ...(cookies?.["DeviceInfo"] ?? {}),
    isMobile: ServerConfig.crawl.content === "mobile",
    type: ServerConfig.crawl.content,
  });
  const localeInfoStringify = JSON.stringify(cookies?.["LocaleInfo"]);
  const environmentInfoStringify = JSON.stringify(cookies?.["EnvironmentInfo"]);

  let urlFormatted = `${url}${
    url.indexOf("?") === -1 ? "?" : "&"
  }botInfo=${botInfoStringify}&deviceInfo=${deviceInfoStringify}&localeInfo=${localeInfoStringify}&environmentInfo=${environmentInfoStringify}`.trim();

  return urlFormatted;
}; // formatUrl

export const getUrl = (req) => {
  if (!req) return "";

  const pathname = (() => {
    let tmpPathName;
    if (req.headers["redirect"])
      tmpPathName = JSON.parse(req.headers["redirect"] as string)?.path;

    return (tmpPathName || req.url)?.split("?")?.[0];
  })();

  return (
    req.query.urlTesting ||
    req.query.url ||
    (PROCESS_ENV.BASE_URL
      ? PROCESS_ENV.BASE_URL + pathname
      : req.protocol + "://" + req.get("host") + pathname)
  ).trim();
}; // getUrl

export const getPathname = (req) => {
  if (!req) return "";

  const pathname = (() => {
    let tmpPathName;
    if (req.headers["redirect"])
      tmpPathName = JSON.parse(req.headers["redirect"] as string)?.path;

    return (tmpPathName || req.url)?.split("?")?.[0];
  })();

  return pathname;
}; // getPathname

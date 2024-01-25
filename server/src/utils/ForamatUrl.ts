import { Response } from "express";
import { IBotInfo } from "../types";
import { getCookieFromResponse } from "./CookieHandler";
import { PROCESS_ENV } from "./InitEnv";

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

  const deviceInfoStringify = JSON.stringify(cookies?.["DeviceInfo"]);
  const localeInfoStringify = JSON.stringify(cookies?.["LocaleInfo"]);
  const environmentInfo = JSON.stringify(cookies?.["EnvironmentInfo"]);

  let urlFormatted = `${url}${
    url.indexOf("?") === -1 ? "?" : "&"
  }botInfo=${botInfoStringify}&deviceInfo=${deviceInfoStringify}&localeInfo=${localeInfoStringify}&environmentInfo=${environmentInfo}`.trim();

  return urlFormatted;
}; // formatUrl

export const getUrl = (req) => {
  if (!req) return "";

  return (
    req.query.urlTesting ||
    (PROCESS_ENV.BASE_URL
      ? PROCESS_ENV.BASE_URL + req.originalUrl
      : req.protocol + "://" + req.get("host") + req.originalUrl)
  ).trim();
}; // getUrl

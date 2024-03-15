import path from "path";

const dotenv = require("dotenv");

export const ENV = (
  ["development", "production"].includes(process.env.ENV as string)
    ? process.env.ENV
    : "production"
) as "development" | "production";
export const MODE = (
  ["development", "preview", "production"].includes(process.env.MODE as string)
    ? process.env.MODE
    : process.env.ENV === "development"
    ? "development"
    : "production"
) as "development" | "preview" | "production";

const envModeList = {
  // NOTE - This means you can debug staging and production in development environment
  development_development: "development",
  development_preview: "staging",
  development_production: "production",

  // NOTE - This means your final environment you need to deploy
  production_development: "staging",
  production_preview: "uat",
  production_production: "production",
};
export const ENV_MODE = envModeList[`${ENV}_${MODE}`] as
  | "development"
  | "staging"
  | "uat"
  | "production";

interface IProcessENV {
  PLATFORM: string;
  HOSTNAME: string;
  ADDRESS: string;
  IS_SERVER: string;
  IS_REMOTE_CRAWLER?: boolean;
  CRAWLER: string;
  CRAWLER_SECRET_KEY: string;
  [key: string]: string | boolean | undefined;
}

export const PROCESS_ENV = (() => {
  dotenv.config({
    path: path.resolve(__dirname, "../../.env"),
  });

  switch (ENV_MODE) {
    case "development":
      break;
    case "staging":
      dotenv.config({
        path: path.resolve(__dirname, "../../.env.staging"),
        override: true,
      });
      break;
    case "uat":
      dotenv.config({
        path: path.resolve(__dirname, "../../.env.uat"),
        override: true,
      });
      break;
    default:
      dotenv.config({
        path: path.resolve(__dirname, "../../.env.production"),
        override: true,
      });
      break;
  }

  const tmpProcessEnv = process.env as IProcessENV;

  tmpProcessEnv.BUILD_TOOL = "";
  tmpProcessEnv.RESET_RESOURCE = true;

  if (process.env.IS_REMOTE_CRAWLER !== undefined) {
    tmpProcessEnv.IS_REMOTE_CRAWLER = ["false", "0", ""].includes(
      process.env.IS_REMOTE_CRAWLER as string
    )
      ? false
      : true;
  }

  return tmpProcessEnv;
})();

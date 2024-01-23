import path from "path";
import { ENV_MODE } from "../constants";

const dotenv = require("dotenv");

const PROCESS_ENV = (() => {
  dotenv.config({
    path: path.resolve(__dirname, "../../.env"),
  });

  if (ENV_MODE !== "development") {
    dotenv.config({
      path: path.resolve(__dirname, "../../.env.production"),
      override: true,
    });
  }

  return process.env;
})();

export default PROCESS_ENV;

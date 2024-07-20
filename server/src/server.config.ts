import { defineServerConfig } from "./utils/ServerConfigHandler";

const ServerConfig = defineServerConfig({
  locale: {
    enable: true,
    defaultLang: "vi",
    defaultCountry: "vn",
    routes: {
      "/login": {
        enable: false,
      },
    },
  },
  crawl: {
    enable: true,
    cache: {
      enable: false,
    },
  },
});

console.log(ServerConfig);

export default ServerConfig;

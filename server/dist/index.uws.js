"use strict"; function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; } function _optionalChain(ops) { let lastAccessLHS = undefined; let value = ops[0]; let i = 1; while (i < ops.length) { const op = ops[i]; const fn = ops[i + 1]; i += 2; if ((op === 'optionalAccess' || op === 'optionalCall') && value == null) { return undefined; } if (op === 'access' || op === 'optionalAccess') { lastAccessLHS = value; value = fn(value); } else if (op === 'call' || op === 'optionalCall') { value = fn((...args) => value.call(lastAccessLHS, ...args)); lastAccessLHS = undefined; } } return value; }var _child_process = require('child_process');
var _fs = require('fs'); var _fs2 = _interopRequireDefault(_fs);
var _path = require('path'); var _path2 = _interopRequireDefault(_path);
var _PortHandler = require('../../config/utils/PortHandler');






var _constants = require('./constants');
var _serverconfig = require('./server.config'); var _serverconfig2 = _interopRequireDefault(_serverconfig);
var _InitProcessEnv = require('./utils/InitProcessEnv'); var _InitProcessEnv2 = _interopRequireDefault(_InitProcessEnv);

const dotenv = require("dotenv");
dotenv.config({
  path: _path2.default.resolve(__dirname, "../.env"),
});

if (_constants.ENV_MODE !== "development") {
  dotenv.config({
    path: _path2.default.resolve(__dirname, "../.env.production"),
    override: true,
  });
}

require("events").EventEmitter.setMaxListeners(200);

const cleanResourceWithCondition = async () => {
  if (_constants.ENV_MODE === "development") {
    // NOTE - Clean Browsers and Pages after start / restart
    const {
      deleteResource,
    } = require(`./puppeteer-ssr/utils/FollowResource.worker/utils.${_constants.resourceExtension}`);
    const browsersPath = _path2.default.resolve(__dirname, "./puppeteer-ssr/browsers");

    return Promise.all([
      deleteResource(browsersPath),
      deleteResource(_constants.pagesPath),
    ]);
  }
};

const startServer = async () => {
  await cleanResourceWithCondition();
  let port =
    _constants.ENV !== "development"
      ? _InitProcessEnv2.default.PORT || _PortHandler.getPort.call(void 0, "PUPPETEER_SSR_PORT")
      : _PortHandler.getPort.call(void 0, "PUPPETEER_SSR_PORT");
  port = await _PortHandler.findFreePort.call(void 0, port || _InitProcessEnv2.default.PUPPETEER_SSR_PORT || 8080);
  _PortHandler.setPort.call(void 0, port, "PUPPETEER_SSR_PORT");

  if (_constants.ENV !== "development") {
    _InitProcessEnv2.default.PORT = port;
  }

  const app = require("uWebSockets.js")./*SSL*/ App({
    key_file_name: "misc/key.pem",
    cert_file_name: "misc/cert.pem",
    passphrase: "1234",
  });

  if (_serverconfig2.default.crawler && !_InitProcessEnv2.default.IS_REMOTE_CRAWLER) {
    app.get("/robots.txt", (res, req) => {
      try {
        const body = _fs2.default.readFileSync(_path2.default.resolve(__dirname, "../robots.txt"));
        res.end(body);
      } catch (e) {
        res.writeStatus("404");
        res.end("File not found");
      }
    });
  }
  (await require("./puppeteer-ssr/index.uws").default).init(app);

  app.listen(Number(port), (token) => {
    if (token) {
      console.log(`Server started port ${port}. Press Ctrl+C to quit`);
      _optionalChain([process, 'access', _ => _.send, 'optionalCall', _2 => _2("ready")]);
    } else {
      console.log(`Failed to listen to port ${port}`);
    }
  });

  process.on("SIGINT", async function () {
    await app.close();
    process.exit(0);
  });

  if (!_InitProcessEnv2.default.IS_REMOTE_CRAWLER) {
    if (_constants.ENV === "development") {
      const serverIndexFilePath = _path2.default.resolve(__dirname, "./index.uws.ts");
      // NOTE - restart server onchange
      // const watcher = chokidar.watch([path.resolve(__dirname, './**/*.ts')], {
      // 	ignored: /$^/,
      // 	persistent: true,
      // })

      if (!_InitProcessEnv2.default.REFRESH_SERVER) {
        _child_process.spawn.call(void 0, "vite", [], {
          stdio: "inherit",
          shell: true,
        });
      }

      // watcher.on('change', async (path) => {
      // 	Console.log(`File ${path} has been changed`)
      // 	await app.close()
      // 	setTimeout(() => {
      // 		spawn(
      // 			'node',
      // 			[
      // 				`cross-env REFRESH_SERVER=1 --require sucrase/register ${serverIndexFilePath}`,
      // 			],
      // 			{
      // 				stdio: 'inherit',
      // 				shell: true,
      // 			}
      // 		)
      // 	})
      // 	process.exit(0)
      // })
    } else if (!_constants.serverInfo.isServer) {
      _child_process.spawn.call(void 0, "vite", ["preview"], {
        stdio: "inherit",
        shell: true,
      });
    }
  }
};

startServer();

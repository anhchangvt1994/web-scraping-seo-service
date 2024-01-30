import WokerPool from "workerpool";
import { urlList } from "./constants";
import { resourceExtension } from "../../constants";

const testPuppeteerSSRService = (() => {
  const _init = () => {
    const TestPool = WokerPool.pool(
      __dirname + `/test.worker.${resourceExtension}`,
      {
        minWorkers: 1,
        maxWorkers: 10,
      }
    );

    const domain = "http://localhost:8080";
    urlList.forEach(async (url) => {
      let tmpUrl = `${domain}?urlTesting=${url}`;
      try {
        TestPool.exec("loadCapacityTest", [tmpUrl]);
      } catch (err) {
        console.error(err);
      }
    });
  };

  return {
    init: _init,
  };
})();

testPuppeteerSSRService.init();

export default testPuppeteerSSRService;

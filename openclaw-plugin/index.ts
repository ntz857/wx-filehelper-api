import type { OpenClawPluginApi } from "openclaw/plugin-sdk/core";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk/core";
import { wechatFilehelperPlugin } from "./src/channel.js";
import { setWeChatRuntime } from "./src/monitor.js";

export { wechatFilehelperPlugin } from "./src/channel.js";
export { monitorWeChatProvider } from "./src/monitor.js";

const plugin = {
  id: "wechat-filehelper",
  name: "WeChat FileHelper",
  description: "WeChat FileHelper channel plugin",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    setWeChatRuntime(api.runtime);
    api.registerChannel({ plugin: wechatFilehelperPlugin });
  },
};

export default plugin;

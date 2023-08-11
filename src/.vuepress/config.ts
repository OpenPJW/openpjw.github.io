import { defineUserConfig } from "vuepress";
import theme from "./theme.js";

export default defineUserConfig({
  base: "/",

  locales: {
    "/": {
      lang: "zh-CN",
      title: "PJW的开源笔记",
      description: "PJW公开写作的地方",
    },
  },

  theme,

  // Enable it with pwa
  // shouldPrefetch: false,
});

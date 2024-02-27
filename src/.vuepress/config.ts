import { defineUserConfig } from "vuepress";
import theme from "./theme.js";

export default defineUserConfig({
  base: "/",

  locales: {
    "/": {
      lang: "zh-CN",
      title: "PJW的网络空间",
      description: "PJW想分享的～",
    },
  },

  theme,

  // Enable it with pwa
  // shouldPrefetch: false,
});

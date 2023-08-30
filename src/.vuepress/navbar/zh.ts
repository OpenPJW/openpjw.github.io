import { navbar } from "vuepress-theme-hope";

export const zhNavbar = navbar([
  {
    text: "主页",
    link: "/"
  },
  {
    text: "我的关注",
    children: [
      {
        text: "有趣的作品",
        link: "/list/有趣的作品.md"
      },
      {
        text: "榜样们",
        link: "/list/向榜样学习.md"
      }
    ]
  }
]);

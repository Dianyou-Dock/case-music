# The Lost Storm 汉化版

`games/the-lost-storm` 是 [Dianyou-Dock/the-lost-storm](https://github.com/Dianyou-Dock/the-lost-storm) 的 Git 子模块，固定在汉化分支的提交上。该项目沿用上游 MIT 许可；源码与素材的许可说明见子模块内的 `LICENSE` 和 `ASSETS.md`。

首次拉取 case-music 后，执行：

```bash
git submodule update --init --recursive
cd games/the-lost-storm
npm ci
npm run build:portal
python3 -m http.server 5193 --bind 127.0.0.1 --directory dist-portal
```

然后打开 <http://127.0.0.1:5193/>。游戏进度保存在当前浏览器本地。`npm run build:portal` 生成可离线部署的静态文件，运行时不依赖 case-music 后端。

进入游戏后，点击画面下方（手机横屏为右上角）的“自动战斗”开关，即可自动攻击附近敌人。玩家点击移动、拾取或主动施放技能时，手动操作优先；自动追击限制在玩家最近一次手动停留的位置附近。自动战斗不会替玩家跑图或拾取物品。

汉化源码在子模块的 `src/i18n/`。更新汉化时，先在 [汉化仓库](https://github.com/Dianyou-Dock/the-lost-storm) 提交，再将子模块更新到新提交并在 case-music 中提交引用。

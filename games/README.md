# 摸鱼游戏

`games/the-lost-storm` 是 [Dianyou-Dock/the-lost-storm](https://github.com/Dianyou-Dock/the-lost-storm) 的 Git 子模块，固定在摸鱼游戏离线刷图分支的提交上。该项目沿用上游 MIT 许可；源码与素材的许可说明见子模块内的 `LICENSE` 和 `ASSETS.md`。

首次拉取 case-music 后，执行：

```bash
git submodule update --init --recursive
cd games/the-lost-storm
npm ci
npm run build:portal
python3 -m http.server 5193 --bind 127.0.0.1 --directory dist-portal
```

然后打开 <http://127.0.0.1:5193/>。游戏进度保存在当前浏览器本地。case-music 的左侧菜单及手机底部导航也提供“摸鱼游戏”入口；启动或构建 core 时会将游戏静态文件复制到同源的 `/moyu-static/`，手机端可在应用内进入。切回音乐时游戏画面会隐藏，返回游戏不会重新加载；运行时不依赖 case-music 后端。

进入游戏后，点击画面下方（手机横屏为右上角）的“自动战斗”开关，即可自动攻击附近敌人。玩家点击移动、拾取或主动施放技能时，手动操作优先；自动追击限制在玩家最近一次手动停留的位置附近。自动战斗不会替玩家跑图或拾取物品。

“随机进图”会从当前等级可进入的十张战斗地图中随机选择，重复进入会重新刷怪，不需要完成原作任务。每张图深处有首领挑战者，完成对话才会唤出首领，不影响普通刷图。首领生命和伤害按角色生命调整，击败后固定掉落一件魔法装备；自动战斗不会主动攻击首领，需要手动应对。五行天赋面板已加入 424 个设计节点，支持路径和配比加点；热兵器天赋和连脉插槽暂时锁定。当前战斗词条效果尚未接入，面板用于验证构筑路线。

汉化源码在子模块的 `src/i18n/`。更新汉化时，先在 [汉化仓库](https://github.com/Dianyou-Dock/the-lost-storm) 提交，再将子模块更新到新提交并在 case-music 中提交引用。

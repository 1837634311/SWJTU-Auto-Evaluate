# 西南交大教务系统一键评价助手

## 📖 简介

这是一个用于 **西南交通大学教务系统** 的油猴脚本，帮助同学快速完成繁琐的课程评价。

不同于其他评价脚本，本脚本能够一键全自动进行评价，且能跳过 1 分钟检测时间限制。

## 🛠️ 使用教程

### 1. 安装环境
你需要先在浏览器中安装 **Tampermonkey (油猴)** 插件：
*   [Chrome 商店](https://chrome.google.com/webstore/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo)
*   [Edge 商店](https://microsoftedge.microsoft.com/addons/detail/tampermonkey/iikmkjmpaadaobahmlepeloendndfphd)

### 2. 安装脚本
在 [GreasyFork](https://greasyfork.org/en/scripts/558725-%E8%A5%BF%E5%8D%97%E4%BA%A4%E5%A4%A7%E6%95%99%E5%8A%A1%E7%B3%BB%E7%BB%9F%E4%B8%80%E9%94%AE%E8%AF%84%E4%BB%B7%E5%8A%A9%E6%89%8B) 安装。

或：

1.  点击油猴插件图标 -> **添加新脚本**。
2.  删除编辑框内所有默认代码。
3.  将项目中的 `autofill.js` 代码完整复制粘贴进去。
4.  按 `Ctrl + S` 保存。

### 3. 开始使用
1.  登录教务系统，进入 **“课程评价” → “课程评价”** 列表页。
2.  你会看到页面右上角出现一个 **悬浮面板**。
3.  点击 **“🚀 开始全自动评价”**。
4.  脚本会自动处理所有课程。完成后会自动跳转到成绩查询页面。

<img width="883" height="224" alt="image" src="https://github.com/user-attachments/assets/bfd434b5-ef04-43ed-966a-04fc5f94113f" />


### 自定义评语
在 `autofill.js` 的 `Actions.fillForm` 方法中，找到 `comments` 数组即可修改：

```javascript
const comments = [
    "老师授课认真负责，重点突出...",
    "课程内容充实...",
    "无",
    "暂无建议"
];
```

---

## 💻 开发指南

如果你想自定义评语或修改逻辑，请参考以下说明：

### 代码结构
脚本采用模块化设计，易于维护：

*   **`CONFIG`**: **配置中心**。修改这里可以调整评语库、选择器或延时参数。
*   **`Utils`**: 工具库。包含日志记录、`sleep` 延时以及核心的 **`State` (状态管理)**（基于 `sessionStorage`）。
*   **`UI`**: 负责绘制和更新右上角的悬浮面板。
*   **`Actions`**: 原子操作库。如 `scanCourses` (扫描链接), `fillForm` (填表), `submitForm` (提交)。
*   **`Controllers`**: **核心逻辑控制器**。
    *   `onListPage`: 处理列表页的队列调度和跳转。
    *   `onDetailPage`: 处理问卷页的提交逻辑（含 Bug 利用状态机）。
    *   `onErrorPage`: 处理错误页的自动返回逻辑。

### 跳过检测原理
教务系统会对过快的提交进行拦截（显示“参数错误”），但返回之后便无限制：

1.  **第一次提交 (`ATTEMPT_1`)**：脚本光速填表并提交 -> **触发系统拦截**，跳转至错误页。
2.  **自动返回 (`Error Page`)**：脚本在错误页捕获状态，自动点击浏览器“返回”。
3.  **第二次提交 (`RETRY`)**：返回到表单页后，通过 `sessionStorage` 识别出是重试状态 -> **再次提交**。此时系统会放行。

---

## ⚠️ 免责声明
本脚本仅供学习交流使用，作者不对使用该脚本导致的任何后果负责。请合理使用，建议在确实听过课并认可老师教学质量的前提下使用便捷评价。

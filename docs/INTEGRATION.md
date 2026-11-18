# 宿主集成

前端默认自带示例，可导入 JSON、下载完整工程和导出修改数据。接入自己的平台时，在 `app.js` 执行前定义 `window.DirectorsStageHost`。未配置任何接口也能运行本地模式。

## 三个可选接口

```js
window.DirectorsStageHost = {
  async loadProject({ params }) {
    // params 是当前 URL 查询参数的普通对象。
    // 使用你自己的项目 API 读取；返回 plan 或下文的工程封装。
    // 返回 null/undefined 会载入通用示例，读取失败应 throw Error。
    return yourProjectLoader(params);
  },
  async saveProject(project, { changes }) {
    // project 是完整可重开的工程；changes 是结构化修改包。
    // 由宿主落实用户身份、项目权限、版本冲突与持久化。
    await yourProjectSaver(project, changes);
    return { saved: true }; // 只有服务器真实确认后才返回成功。
  },
  async getReferenceMedia({ project, reference }) {
    // 有 reference 的镜头才显示参考视频入口。
    // 返回 URL 字符串，或 { url, expires_at: UNIX秒 }。
    return yourMediaResolver(project, reference);
  }
};
```

以上 `yourProjectLoader` 等名称是接入方需要实现的函数，并非本仓库提供的服务。未配置 `saveProject` 时，保存按钮下载 `directors-stage-project.json`。接口报错或未明确返回 `{saved:true}` 时显示错误，保留当前编辑；不会跳到其他网站或自动调用 Agent。

建议把配置写在自己的 `host.js`，在 `index.html` 中于 `app.js` 之前引入。不要把长效密钥或服务端凭据放进前端。跨域 iframe 消息通信、登录和后端权限属于宿主集成范围，本仓库不会默认信任任意窗口的消息。

## 编辑器 API

```js
const editor = await window.stageEditor.ready;

// 支持纯 plan，或包含 plan 的完整工程。
await editor.openProject(project, { restoreDraft: false });

const complete = editor.exportProject();
const changes = editor.exportChanges();

const unsubscribe = editor.subscribe(state => {
  // state 含当前镜头、时间、场景、主体和实际取景状态。
  // 不要直接修改 state；需要持久化时使用上面的导出方法。
});
```

`ready` 在初次加载成功后完成，失败时拒绝；`openProject` 在校验失败时保留当前工程。`restoreDraft` 默认开启，同一工程身份、版本和基础内容才能恢复对应浏览器草稿。打开其他工程会重置选择、撤销历史与编辑面板。

## 工程封装

完整导出为：

```js
{
  kind: 'directors-stage-ui-project',
  schema: 1,
  id: 'your-stage-id',
  revision: 1,
  can_edit: true,
  // 可选：project_id、document_id、conversation_id、project_title、shot_id。
  baseline: { /* 本次编辑所基于的 plan */ },
  plan: { /* 当前 plan */ },
  edits: {
    changed: [],
    snapshot_marks: [],
    scene_edits: [],
    deleted_shots: []
  }
}
```

省略身份时，导入器根据基础计划内容生成本地身份。已有工程建议由宿主提供稳定 `id`、`revision`。`can_edit:false` 用于只读界面，但客户端状态不能代替服务端权限校验。

修改包包含 `stage_id`、`base_revision`、可选项目／文档 ID、当前 `plan`、`snapshot_marks`、`scene_edits` 和 `deleted_shots`。它不附带任何 Agent 执行指令。

宿主推进云端版本后，可在保存调用结束后用新的规范工程调用 `openProject(newProject, {restoreDraft:false})`，建立新的编辑基线。默认保存回调不会自行推测服务器版本，也不会自动重新加载工程。

参考视频地址仅接受 HTTP、HTTPS 或 Blob URL。引用权限、URL 时效和视频源的跨域策略由宿主负责。

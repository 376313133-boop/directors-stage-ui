# 工程数据

编辑器接受纯 `plan`，也可由宿主提供包含 `plan` 的工程封装。完整可导入样例见 [minimal-project.json](../examples/minimal-project.json)，默认演示见 [demo.json](../web/demo.json)。

## Plan

- `version: 1`：计划格式版本。
- `title`：工程名称。
- `output.width / height / fps`：取景画幅与时间采样设置。
- `scenes`：以场景 ID 为键的对象，每场有 `objects`。
- `shots`：按播放顺序保存镜头，每镜绑定一个 `scene`。
- `videos`：可选视频分组，镜头通过 `video_id` 关联。

几何体用 `id`、`shape`、`position`、`size` 定义，形状为 `box`、`sphere`、`cylinder`。单位米，Y 轴朝上；`position` 是底部中心，`size` 是宽、高、深。`actor_id` 可关联人物部件，使用同一个身份选择和处理；不应把它当作任意层级的骨骼系统。

摄影机使用 `position`、`target`、`focal_mm`，可包含 `roll_deg`、`sensor_width_mm`、`lens_model`。镜头长度在 `duration_s`。

相机路径在 `shot.motion` 中，关键帧 `t` 为归一化时间。`timing_mode: "arrival"` 时，`motion.duration_s` 等于整镜时长，关键帧可包含以秒计的 `hold_s`。

物体轨迹写在 **`shot.object_tracks[对象ID]`**，每条轨迹的键包含 `t`、`position` 和可选 `yaw_deg`。放到 `scene.objects[]` 中不会成为镜头运动。多部件角色使用各自真实对象 ID 的同步轨迹。

主体状态使用 `shot.state_events[根对象ID]`，事件需要唯一 `id`、`type`、`at_s`，以及该事件支持的参数。宿主应沿用编辑器导出的完整数据，并在服务端验证，避免手工重组时丢掉时间、身份或状态。

## 完整工程与修改数据

完整工程用于打开、保存和继续编辑。结构化修改数据用于宿主增量处理，包含完整计划、基础版本、已改镜头、场景改动、显式删除的镜号及快照标记。

快照标记保存当时的 `frozen_plan`，是可复现的场景状态，不是图片上传。宿主可以自行消费这些数据；本仓库不自动调用生成服务。

修改数据中的“删除镜头”只描述当前工程的变更。是否删除数据库记录、素材或历史版本，由宿主单独决定，不能仅凭文件里没有出现就推断删除。

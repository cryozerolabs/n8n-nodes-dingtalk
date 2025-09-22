# 钉钉 n8n 节点示例工作流

这个目录包含了各种使用钉钉 n8n 节点的示例工作流，帮助你快速上手和了解各种功能的使用方法。

## 📁 示例文件

### 基础功能示例
- `钉钉-基础-AI表格操作.json` - 完整的 AI 表格操作演示，包括：
  - 用户信息获取（获取 unionId）
  - AI 表格 URL 解析（提取 baseId、sheetId、viewId）
  - 数据表管理（创建、获取、更新、删除）
  - 记录操作（新增、查询、更新、删除）
  - 访问令牌获取演示

### 📝 更多示例（规划中）
- `综合-自动化场景.json` - 结合多个功能的实际业务场景

## 🚀 使用方法

### 1. 导入工作流

**方法一：通过 URL 导入（推荐）**
```
https://raw.githubusercontent.com/cryozerolabs/n8n-nodes-dingtalk/main/examples/[文件名].json
```

**方法二：下载文件导入**
1. 下载对应的 JSON 文件
2. 在 n8n 中点击 "Import from file"
3. 选择下载的 JSON 文件

### 2. 配置凭据

导入工作流后，你需要：
1. **配置钉钉 API 凭据**（Corp ID、Client ID 和 Client Secret）
2. **调整实际参数**：
   - 修改示例中的 AI 表格 URL 为你的真实表格链接
   - 设置正确的用户 ID（用于获取 unionId）
   - 根据你的表格结构调整字段名称
3. **运行测试**

### 3. 自定义修改

- 根据你的实际需求修改参数
- 添加或删除节点
- 调整工作流逻辑

## 📝 注意事项

- **示例已测试** - 当前的 AI 表格操作示例已在实际环境中测试通过
- **权限要求** - 确保你的钉钉应用具有以下权限：
  - 通讯录只读权限（获取用户信息）
  - AI 表格操作权限
- **参数配置** - 示例中的以下参数需要替换为你的真实数据：
  - AI 表格 URL（包含你的 baseId、sheetId）
  - 用户 ID（用于获取 unionId）
  - 表格字段名称（根据你的表格结构）
- **测试建议** - 建议先在测试环境中运行，避免影响生产数据

## 🤔 需要帮助？

如果在使用示例过程中遇到问题：

1. 检查凭据配置是否正确
2. 确认钉钉应用权限是否充足
3. 查看 [主要文档](../README.md)
4. 提交 [GitHub Issue](https://github.com/cryozerolabs/n8n-nodes-dingtalk/issues)

## 🔄 持续更新

我们会持续添加新的示例，涵盖更多使用场景。如果你有好的示例想要分享，欢迎提交 Pull Request！


https://alidocs.dingtalk.com/i/nodes/gvNG4YZ7JnkovqmwFZX41RPl82LD0oRE?iframeQuery=entrance%3Ddata%26sheetId%3DhERWDMS%26source%3Dnotable_portal%26viewId%3DqvGDAH2&sideCollapsed=true
# NPM Package Monitor

一个用于监控新发布的 NPM 包的 Cloudflare Worker 项目。当有新的 NPM 包发布时，会通过 Slack 通知。

## 主要功能

- 监控 NPM 的新包发布
- 解析 RSS feed 获取新包信息
- 获取包的最新版本信息
- 将新包信息存储到数据库
- 通过 Slack webhook 发送通知

## 技术细节

### 关键组件

1. **XML 解析器**
   - 解析 NPM RSS feed
   - 提取包名、链接、发布日期、描述和创建者信息

2. **版本解析器**
   - 从 NPM 包页面解析版本信息
   - 使用 HTMLRewriter 处理版本页面
   - 计算最接近当前时间的版本

3. **数据库存储**
   - 使用 Cloudflare D1 数据库
   - 表名：`npm_packages`
   - 存储字段：name, version, published_at

### 环境变量

- `SLACK_WEBHOOK_URL`: Slack webhook URL，用于发送通知

### API 端点

- `GET /?package=<package-name>`: 获取指定包的版本信息

## 开发说明

1. 本地开发：
   ```bash
   npm run dev
   ```

2. 测试定时任务：
   ```bash
   curl "http://localhost:8787/__scheduled?cron=*+*+*+*+*"
   ```

3. 部署：
   ```bash
   npm run deploy
   ```

## 注意事项

- 确保在部署前设置好 `SLACK_WEBHOOK_URL` 环境变量
- 数据库表结构：
  ```sql
  CREATE TABLE npm_packages (
    name TEXT,
    version TEXT,
    published_at TEXT,
    PRIMARY KEY (name, version)
  );
  ```
- 定时任务配置在 `wrangler.jsonc` 中设置

## 调试提示

- 代码中包含详细的日志记录，可以通过 Cloudflare Workers 的日志查看运行状态
- 版本解析器会输出所有找到的版本信息，方便调试版本匹配问题 
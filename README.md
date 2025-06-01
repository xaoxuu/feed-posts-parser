# feed-post-parser

解析友链RSS地址，获取最新发布的文章，并将其转换为统一的格式，方便聚合和展示。

## 项目简介

`feed-post-parser` 是一个用于解析RSS/Atom/JSON Feed的工具，旨在从友链或博客订阅中提取最新的文章信息。它可以帮助您：

- 自动抓取指定Feed源的最新内容。
- 统一不同Feed格式的数据结构。
- 方便地集成到其他应用或服务中，用于内容聚合、数据分析等。

## 如何使用

该项目作为一个GitHub Action运行，或者作为独立的Node.js脚本运行。具体使用方式请参考 `action.yml` 或 `src/main.js` 文件。

例如，作为GitHub Action使用时，您可以在工作流中配置：

```yaml
name: Feed Posts Parser

on:
  workflow_dispatch: # Allows manual triggering
  schedule:
    - cron: '0 21 * * *' # Runs daily at 21:00 UTC

jobs:
  feed-parser:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
        with:
          ref: output
      - name: Run Feed Post Parser Action
        uses: xaoxuu/feed-posts-parser@main
        with:
          data_path: 'v2/data.json'
          posts_count: '2'
          date_format: 'YYYY-MM-DD HH:mm'
      # 更新完毕后提交一下
      - name: Setup Git Config
        run: |
          git config --global user.name 'github-actions[bot]'
          git config --global user.email 'github-actions[bot]@users.noreply.github.com'
      - name: Commit and Push to output branch
        run: |
          git fetch origin output || true
          git checkout -B output
          git add --all
          git commit -m "Update data from issues" || echo "No changes to commit"
          git push -f origin output
```

### 3. 配置

根据您的需求，可能需要修改 `src/main.js` 或 `action.yml` 中的配置。

## 项目结构

```
.github/
├── workflows/ # GitHub Actions 工作流
│   └── test-workflow.yml
├── .gitignore
├── LICENSE
├── README.md
├── action.yml # GitHub Action 定义文件
├── dist/
│   ├── index.js # 编译后的JavaScript文件
│   └── licenses.txt
├── package-lock.json
├── package.json
├── src/
│   ├── main.js # 主要逻辑文件
│   └── utils.js # 辅助工具函数
└── v2/
    └── data.json # 示例数据或旧版本数据
```

## 贡献

欢迎提交Issue或Pull Request。

## 许可证

本项目采用 [MIT License](LICENSE) 许可。

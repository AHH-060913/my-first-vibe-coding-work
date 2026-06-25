# 我的第一个vibe coding作品

一个中文 A 股个人投研看板，也是我的第一个 vibe coding 作品。项目覆盖大盘指数、科技/新能源/显示/光伏主题、个股行情、涨跌排行、热门板块、财经新闻、公司公告、自选股和 1/3/5 个交易日量化评分。

## 在线展示

项目支持 GitHub Pages 静态演示部署。公开页面使用内置 seed 数据，不依赖后端服务，适合给大家直接打开浏览。

完整本地版仍然支持 FastAPI + AKShare + SQLite，用于连接免费 A 股数据源和本地缓存。

## 技术栈

- 前端：React + Vite + TypeScript + ECharts + lucide-react
- 后端：FastAPI + AKShare + pandas + scikit-learn + SQLite
- 数据模式：默认 `seed`，可通过 `A_DASHBOARD_DATA_MODE=auto` 或 `live` 切换到 AKShare 免费数据源
- 公开部署：GitHub Pages + `VITE_STATIC_DEMO=true`

## 快速启动

```powershell
# 后端
cd backend
python -m venv .venv
.\.venv\Scripts\python -m pip install -r requirements.txt
.\.venv\Scripts\python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000

# 前端
cd ..\frontend
npm install
npm run dev
```

访问：http://127.0.0.1:5173

## GitHub Pages 部署

仓库推送到 GitHub 后，`.github/workflows/pages.yml` 会在 `main` 分支 push 时自动构建静态演示版并发布到 GitHub Pages。

构建命令等价于：

```powershell
cd frontend
$env:VITE_STATIC_DEMO="true"
npm run build:static
```

## 数据模式

默认使用内置样例数据，保证本地页面稳定可打开：

```powershell
$env:A_DASHBOARD_DATA_MODE="seed"
```

切换到免费实时数据源优先、失败后降级：

```powershell
$env:A_DASHBOARD_DATA_MODE="auto"
```

仅使用 AKShare，失败则报错：

```powershell
$env:A_DASHBOARD_DATA_MODE="live"
```

## API

- `GET /api/market/overview`
- `GET /api/stocks`
- `GET /api/stocks/{code}`
- `GET /api/sectors?theme=tech|new_energy|display|pv`
- `GET /api/rankings?type=gainers|losers|turnover|volume_ratio|hot_sector|model_score`
- `GET /api/news`
- `GET /api/announcements`
- `GET /api/predictions?code=&theme=&horizon=1|3|5`
- `GET /api/watchlist`
- `POST /api/watchlist`
- `DELETE /api/watchlist/{code}`

## 测试

```powershell
cd backend
.\.venv\Scripts\python -m pytest

cd ..\frontend
npm run build
```

## 说明

量化预测只展示上涨概率、跑赢概率、置信度、因子贡献和风险提示，不展示买入/卖出建议。结果仅供研究，不构成投资建议。

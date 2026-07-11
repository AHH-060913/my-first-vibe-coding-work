# 我的第一个vibe coding作品

一个中文 A 股个人投研看板，也是我的第一个 vibe coding 作品。项目覆盖大盘指数、科技/新能源/显示/光伏主题、个股行情、涨跌排行、热门板块、财经新闻、公司公告、自选股、在线股票搜索和 1/3/5 个交易日量化评分。

V2 使用苹果式极简工作台设计，新增市场温度、涨跌分布、行业热力图、独立个股详情、多股基准对比、技术指标、事件时间轴以及浏览器本地研究笔记。

量化预测只展示上涨概率、跑赢概率、置信度、因子贡献和风险提示，不展示买入/卖出建议。结果仅供研究，不构成投资建议。

## 在线展示

GitHub Pages 页面：

https://ahh-060913.github.io/my-first-vibe-coding-work/

公开页面默认支持两种形态：

- 未配置公网后端时：使用内置 `seed` 数据作为静态演示，打开稳定。
- 配置 `VITE_API_BASE_URL` 后：Pages 前端会连接公网 FastAPI 后端，支持在线搜索任意 A 股并解析详情。

## 核心功能

- 大盘指数、市场宽度、成交额、热门板块。
- 市场温度、涨跌分布、行业成交额热力图和指数 20/60/120 日切换。
- 科技、新能源、显示、光伏主题行业页。
- 个股行情表、涨跌排行、成交额排行、换手率排行、量比排行、模型评分榜。
- 在线搜索股票代码或名称，搜索结果可添加到浏览器本地样本池。
- 新增股票会进入个股页、排行、模型预测和自选股视图；样本池保存在 `localStorage:a-share-sample-pool`。
- 股票名称可点击进入可分享的 Hash 详情页，展示 K 线、成交量、MA5/10/20、MACD、RSI、公司背景、事件时间轴和多周期预测。
- 2-5 只股票与沪深300进行归一化收益、超额收益、风险收益和相关性比较。
- 自选股分组、标签和研究笔记保存在当前浏览器，不写入公开共享后端。
- Render 冷启动期间先展示明确标注的演示/缓存数据，云端返回后平滑替换。
- 数据返回 `source`、`updated_at`、`stale`，数据源失败时展示最近可用数据。

## 技术栈

- 前端：React + Vite + TypeScript + ECharts + lucide-react
- 后端：FastAPI + AKShare + pandas + scikit-learn + SQLite
- 免费数据源：新浪/腾讯单股行情优先，AKShare/东方财富全市场数据，其次最近成功缓存，最后 `seed` 样例数据
- 公开部署：GitHub Pages 前端 + Render 免费 FastAPI 后端

## 本地启动

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

前端连接远程后端：

```powershell
$env:VITE_API_BASE_URL="https://你的-render-服务.onrender.com/api"
npm run build
```

## GitHub Pages + Render

1. 在 Render 创建 Web Service，连接这个 GitHub 仓库；仓库内的 `render.yaml` 已配置 `backend` 作为后端服务。
2. Render 后端启动后，打开 `https://你的-render-服务.onrender.com/api/health` 确认在线。
3. 在 GitHub 仓库 `Settings -> Secrets and variables -> Actions -> Variables` 新增变量：
   - `VITE_API_BASE_URL=https://你的-render-服务.onrender.com/api`
4. 推送到 `main` 后，`.github/workflows/pages.yml` 会自动构建 Pages；如果没有设置 `VITE_API_BASE_URL`，会自动回到静态演示模式。

## API

- `GET /api/health`
- `GET /api/market/overview`
- `GET /api/market/indices/{code}/history?days=20|60|120`
- `GET /api/stocks`
- `GET /api/stocks/{code}`
- `GET /api/stocks/{code}/resolve`
- `GET /api/search/stocks?q=`
- `GET /api/sectors?theme=tech|new_energy|display|pv`
- `GET /api/rankings?type=gainers|losers|turnover|volume_ratio|hot_sector|model_score`
- `POST /api/analysis/compare`
- `GET /api/news`
- `GET /api/announcements`
- `GET /api/predictions?code=&theme=&horizon=1|3|5&horizons=1,3,5`
- `GET /api/watchlist`
- `POST /api/watchlist`
- `DELETE /api/watchlist/{code}`

## 测试

```powershell
cd backend
.\.venv\Scripts\python -m pytest

cd ..\frontend
npm test
npm run build
$env:VITE_STATIC_DEMO="true"; npm run build:static
```

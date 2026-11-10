# 直播监督系统 · 运行手册

> 更新：2026-11-10 ｜ 配套：[ARCHITECTURE.md](ARCHITECTURE.md)

## 0. 前置

| 项 | 要求 |
|---|---|
| Python | `D:/LiveVision/.venv/Scripts/python.exe`（系统 Python 缺 `cv2`） |
| 证据目录 | `D:/LiveVision/output/evidence/` |
| 房间配置 | `D:/LiveVision/pipeline/config.json` 的 `rooms` 段 |
| 端口 | 8787 工作台、8771 证据查询台、8770 旧预览页（已停用） |

## 1. 启动与停止

### 1.1 监督工作台（8787）

```bash
python C:/Users/24526/WorkBuddy/监督/serve.py --no-browser
```

打开 `http://127.0.0.1:8787/index.html`。停止：`Ctrl+C`。

### 1.2 证据查询台（8771）

```bash
# 只本机
D:/LiveVision/.venv/Scripts/python.exe D:/LiveVision/liveguard/evidence_server.py --no-browser

# 手机同 WiFi 可访问（启动时会打印手机该输的地址）
D:/LiveVision/.venv/Scripts/python.exe D:/LiveVision/liveguard/evidence_server.py --lan --no-browser

# 多网卡/自动探测不准时手动指定
D:/LiveVision/.venv/Scripts/python.exe D:/LiveVision/liveguard/evidence_server.py --lan 192.168.110.150 --no-browser
```

> `--lan` 只绑指定的那个网卡，`127.0.0.1` 在该模式下不再可用，电脑上也用打印出来的地址。

### 1.3 七房间守候

```bash
D:/LiveVision/.venv/Scripts/python.exe D:/LiveVision/daemon.py \
  --rooms 煲珠公 "夜猫(今天吃什么)" 夜猫团购 动漫AC君 瑞瑞吃喝记 "艾斯AI💫" 五行缺肉 \
  --device cuda --live-every 15 --peak-wait 60 --peak-window 30
```

- 未开播：180 秒退避；开播时间前后 30 分钟：60 秒一轮。
- 已开播：自动起 `monitor.py`，崩溃自动重启。
- 停止：`Ctrl+C`，或结束对应 `python.exe` 进程。

## 2. 查开播状态（三态）

```bash
cd D:/LiveVision/liveguard
D:/LiveVision/.venv/Scripts/python.exe probe_rooms.py --retries 1 --retry-wait 6
```

输出三种状态：

| 状态 | 含义 | 该做什么 |
|---|---|---|
| 在播 | 能解出画面 | 无需处理 |
| 未播 | 房间号明确没有拉流地址 / 场次已结束 | 若"场次已结束"，发当前直播间链接 |
| 未知 | 链接失效、网络异常、页面空壳 | 重试；仍失败就换链接 |

只看某个房间：`--only "瑞瑞吃喝记"`。

## 3. 新开播 / 换场次：更新房间链接

抖音**一场直播一个 `room_id`**，旧号查不到新场次。步骤：

1. 进当前直播间 → 分享 → 复制链接。
2. 把链接写进 `config.json` 对应房间的 `share_url`（或让我改）。
3. 跑一次回写，把新 `room_id` 落库：

```bash
D:/LiveVision/.venv/Scripts/python.exe D:/LiveVision/liveguard/probe_rooms.py --update-config
```

回写规则：解析成功且 `room_id` 变了才写；**先备份**为 `config.json.bak_autoroom`，再原子替换；同值不写。

## 4. 证据查询与核验

| 方式 | 操作 |
|---|---|
| 网页 | `http://<本机IP>:8771/`，按房间/类型/日期筛，点一行直接播 |
| 列表 | `GET /api/events?room=&code=&from=&to=` |
| 单条 | `GET /api/event?id=<event_id>` |
| 核验 | 页面"核验完整性"或 `GET /api/verify`；也可 `python liveguard/evidence.py verify` |
| 重建索引 | `python liveguard/evidence.py rebuild` |

判定"录制是否完整"看 `event.json` 的 `coverage.complete`；页面上覆盖不全的会标红。

## 5. 手机打不开查询台

按顺序排查：

1. **同一 WiFi**：手机连的 WiFi 必须和电脑一致（看电脑的 WLAN 名称）。
2. **地址正确**：`http://<电脑IP>:8771`，是 `http`，不能漏 `:8771`；IP 以启动时打印的"手机访问"为准（换网络会变）。
3. **Windows 防火墙**：确认放行；本机自连成功不代表手机能连（入站规则不同）。
4. **路由器 AP 隔离**：客人网络/设备隔离会让同 WiFi 设备互不可见，需在路由器关闭。
5. **服务是否在跑**：电脑上 `netstat -ano | findstr :8771` 应有 LISTENING。

## 6. 常见状态与处理

| 现象 | 原因 | 处理 |
|---|---|---|
| 显示"场次已结束（房间号是上一场的）" | 配置里是旧场次 `room_id` | 发当前直播间分享链接，`--update-config` 回写 |
| 显示"分享链接已失效" | `v.douyin.com` 短链过期（实测几小时~几天） | 重新复制分享链接 |
| 显示"未知（地址打不开）" | 网络/CDN/限流/刚下播 | 等 1 分钟重试；连续失败再换链接 |
| 快照 `running=true` 但时间很旧 | 上次运行留下的旧文件 | 以 mtime 为准，30 秒内更新才算在跑 |
| 8771 起不来，提示端口被占 | 已有实例（独占绑定） | 先停旧进程；不要同时开默认模式和 `--lan` 模式 |
| 工作台显示"数据已过期" | `latest.json` 超过 40 分钟没更新 | 检查 reporter/monitor 是否在跑，不用旧数据当实时 |
| 单测 `ImportError: cv2` | 用了系统 Python | 换 `D:/LiveVision/.venv/Scripts/python.exe` |

## 7. 备份与回滚

改动前都会留 `.bak_*`：

| 文件 | 备份示例 |
|---|---|
| `pipeline/config.json` | `config.json.bak_1129`、`config.json.bak_1133` |
| `liveguard/probe_rooms.py` | `probe_rooms.py.bak_1129`、`.bak_1133` |
| `pipeline/source.py` | `source.py.bak_1140` |
| `liveguard/evidence_server.py` | `evidence_server.py.bak_1821` |
| `daemon.py` | `daemon.py.bak_1133` |

回滚：把 `.bak_*` 复制回原名，重启对应服务。证据库不要删；索引坏了用 `evidence.py rebuild` 重建。

## 8. 不要做的事

- 不要用 `os.remove` 批量删录制中间文件（平台 safe-delete 会抛 `SystemExit`，静默掐死录制线程）。
- 不要把 `config.json` 的 `room_id` 当成"主播固定号"长期用（它是场次 ID）。
- 不要默认把 8771 绑到 `0.0.0.0`（证据是隐私数据，用 `--lan` 显式开）。
- 不要把证据库放在会被同步盘/清理工具扫描的目录。
- 不要在公共 WiFi 下开 `--lan`。

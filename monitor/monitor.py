#!/usr/bin/env python3
"""
VocaRank Monitor — Real-time TUI dashboard.

Shows:
  • API / Web / PostgreSQL health (latency, status)
  • CPU, RAM, network throughput  (half-width, beside latency chart)
  • Latency history line plot     (WEB prominent ◆, API/PG small ·)
                                  windows: 5m 15m 1h 3h 6h 12h 24h
  • Recent visitor activity       (UTC→local time, full country name)

Usage (from repo root):
    python3 monitor/monitor.py

Keys:
  r        — force immediate refresh
  1–7      — latency window: 5m / 15m / 1h / 3h / 6h / 12h / 24h
  q        — quit
"""
from __future__ import annotations

import asyncio
import os
import time
from collections import deque
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

import psutil
import psycopg2
import requests
from dotenv import load_dotenv
from rich.text import Text
from textual.app import App, ComposeResult
from textual.binding import Binding
from textual.containers import Horizontal, Vertical
from textual.widget import Widget
from textual.widgets import DataTable, Footer, Label, Static

# ── Configuration ─────────────────────────────────────────────────────────────

_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(_ROOT / ".env")

DB_URL  = os.getenv("DATABASE_URL", "postgresql://vocarank:password@localhost/vocarank")
API_URL = "http://localhost:8000"
WEB_URL = "http://localhost:3000"

INTERVAL_SVC = 10   # service health check period (s)
INTERVAL_SYS = 2    # system metrics refresh period (s)
INTERVAL_VIS = 15   # visitor table refresh period (s)
VIS_LIMIT    = 200   # max rows in visitor table

# ── Utilities ─────────────────────────────────────────────────────────────────

def _db_params() -> dict:
    p = urlparse(DB_URL)
    return dict(
        host=p.hostname, port=p.port or 5432,
        user=p.username, password=p.password,
        dbname=p.path.lstrip("/"),
    )

def _fmt_speed(bps: float) -> str:
    if bps >= 1_000_000:
        return f"{bps / 1_000_000:6.2f} Mbps"
    if bps >= 1_000:
        return f"{bps / 1_000:6.1f} Kbps"
    return f"{bps:6.0f}  bps"

def _bar(pct: float, width: int = 22) -> str:
    filled = round(pct / 100 * width)
    return "█" * filled + "░" * (width - filled)

def _utc_to_local_hms(ts: str) -> str:
    """Parse a UTC timestamp string, convert to machine local time, return HH:MM:SS."""
    ts = ts.strip().replace("T", " ")
    base = ts[:19]  # trim to "YYYY-MM-DD HH:MM:SS"
    try:
        dt_utc = datetime.fromisoformat(base).replace(tzinfo=timezone.utc)
        return dt_utc.astimezone().strftime("%H:%M:%S")
    except Exception:
        return ts[-8:] if len(ts) >= 8 else ts

def _is_internal(ip: str) -> bool:
    return ip.startswith((
        "10.", "127.", "::1",
        "192.168.",
        "172.16.", "172.17.", "172.18.", "172.19.", "172.20.", "172.21.",
        "172.22.", "172.23.", "172.24.", "172.25.", "172.26.", "172.27.",
        "172.28.", "172.29.", "172.30.", "172.31.",
    ))

# ── Network throughput tracker ────────────────────────────────────────────────

class _NetTracker:
    def __init__(self) -> None:
        c = psutil.net_io_counters()
        self._t, self._s, self._r = time.monotonic(), c.bytes_sent, c.bytes_recv

    def sample(self) -> tuple[float, float]:
        c  = psutil.net_io_counters()
        dt = max(time.monotonic() - self._t, 1e-6)
        up = (c.bytes_sent - self._s) / dt
        dn = (c.bytes_recv - self._r) / dt
        self._t, self._s, self._r = time.monotonic(), c.bytes_sent, c.bytes_recv
        return up, dn

_NET = _NetTracker()

# ── IP Geolocation (cached, batch via ip-api.com) ─────────────────────────────

# ip → full country name, e.g. "Taiwan", "United States"
_ip_cache: dict[str, str] = {}

def _lookup_countries(ips: list[str]) -> None:
    """Batch-fetch full country names for unseen public IPs; updates _ip_cache."""
    new = [ip for ip in ips if ip and not _is_internal(ip) and ip not in _ip_cache]
    if not new:
        return
    try:
        resp = requests.post(
            "http://ip-api.com/batch?fields=status,query,country",
            json=new[:100],
            timeout=5,
        )
        for item in resp.json():
            ip   = item.get("query", "")
            name = item.get("country", "") if item.get("status") == "success" else ""
            _ip_cache[ip] = name if name else "Unknown"
    except Exception:
        for ip in new:
            _ip_cache.setdefault(ip, "Unknown")

# ── Blocking data-fetchers (called via asyncio.to_thread) ────────────────────

def _check_api() -> dict:
    try:
        t0 = time.monotonic()
        r  = requests.get(f"{API_URL}/health", timeout=3)
        ms = round((time.monotonic() - t0) * 1000, 1)
        return {"ok": r.status_code == 200, "ms": ms, "code": r.status_code}
    except Exception as e:
        return {"ok": False, "err": str(e)[:55]}

def _check_web() -> dict:
    try:
        t0 = time.monotonic()
        r  = requests.get(f"{WEB_URL}/en", timeout=3, allow_redirects=True)
        ms = round((time.monotonic() - t0) * 1000, 1)
        return {"ok": r.status_code < 400, "ms": ms, "code": r.status_code}
    except Exception as e:
        return {"ok": False, "err": str(e)[:55]}

def _check_pg() -> dict:
    try:
        t0   = time.monotonic()
        conn = psycopg2.connect(**_db_params(), connect_timeout=3)
        ms   = round((time.monotonic() - t0) * 1000, 1)
        cur  = conn.cursor()
        cur.execute("SELECT version()")
        ver = cur.fetchone()[0].split()[1]
        cur.execute("SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")
        tables = cur.fetchone()[0]
        cur.execute("SELECT count(*) FROM songs")
        songs = cur.fetchone()[0]
        cur.execute("SELECT count(*) FROM users")
        users = cur.fetchone()[0]
        conn.close()
        return {"ok": True, "ms": ms, "version": ver,
                "tables": tables, "songs": songs, "users": users}
    except Exception as e:
        return {"ok": False, "err": str(e)[:55]}

def _fetch_visitors(limit: int = VIS_LIMIT) -> list[dict]:
    try:
        conn = psycopg2.connect(**_db_params(), connect_timeout=3)
        cur  = conn.cursor()
        cur.execute("""
            SELECT created_at, ip_address, page_name, 'view'
              FROM site_views
            UNION ALL
            SELECT created_at, ip_address, vote_type, 'vote'
              FROM song_votes
            ORDER BY 1 DESC
            LIMIT %s
        """, (limit,))
        rows = cur.fetchall()
        conn.close()
        result = [{"ts": r[0], "ip": r[1], "page": r[2], "kind": r[3]} for r in rows]

        # Batch-lookup country names for public IPs
        all_ips = list({r["ip"] for r in result if r["ip"]})
        _lookup_countries(all_ips)

        for r in result:
            ip = r.get("ip") or ""
            r["country"] = "" if _is_internal(ip) else _ip_cache.get(ip, "Unknown")
        return result
    except Exception:
        return []

# ── Widgets ───────────────────────────────────────────────────────────────────

class ServiceCard(Static):
    """Health panel for one backend service."""

    def __init__(self, label: str, addr: str, *, id: str) -> None:  # noqa: A002
        super().__init__(id=id)
        self._label = label
        self._addr  = addr
        self._show_pending()

    def _show_pending(self) -> None:
        self.update(
            f" [dim]●[/]  [bold]{self._label}[/]\n"
            f" [dim]Checking…[/]\n"
            f" [dim]{self._addr}[/]\n"
            f" [dim]—[/]"
        )

    def apply(self, r: dict) -> None:
        if r.get("ok"):
            dot  = "[bold green]●[/]"
            stat = "[bold green]ONLINE[/]"
            lat  = f"[bold cyan]{r['ms']} ms[/]"
        else:
            dot  = "[bold red]●[/]"
            stat = "[bold red]OFFLINE[/]"
            lat  = "[dim]—[/]"

        if r.get("version"):
            detail = (
                f"[dim]pg[/] {r['version']}  [dim]·[/]  "
                f"{r.get('songs', '?')} songs  [dim]·[/]  {r.get('users', '?')} users"
            )
        elif r.get("code"):
            detail = f"[dim]HTTP {r['code']}[/]"
        else:
            detail = f"[red]{r.get('err', '')}[/]"

        self.update(
            f" {dot}  [bold]{self._label}[/]\n"
            f" {stat}   {lat}\n"
            f" [dim]{self._addr}[/]\n"
            f" {detail}"
        )


class SysPanel(Static):
    """CPU, RAM, and network throughput — compact half-width panel."""

    def tick(self) -> None:
        cpu = psutil.cpu_percent()
        mem = psutil.virtual_memory()
        up, dn = _NET.sample()

        cpu_c = "red"  if cpu        > 80 else ("yellow" if cpu        > 50 else "green")
        ram_c = "red"  if mem.percent > 85 else ("yellow" if mem.percent > 65 else "cyan")
        ru, rt = mem.used / 1024 ** 3, mem.total / 1024 ** 3

        self.update(
            f"\n"
            f"  CPU  [{cpu_c}]{_bar(cpu)}[/]  [{cpu_c}]{cpu:5.1f}%[/]\n"
            f"  RAM  [{ram_c}]{_bar(mem.percent)}[/]  [{ram_c}]{ru:.1f}[/][dim]/{rt:.1f} GB[/]\n"
            f"\n"
            f"  NET  [bold green]↑ {_fmt_speed(up)}[/]\n"
            f"       [bold cyan]↓ {_fmt_speed(dn)}[/]"
        )


class LatencyPanel(Widget):
    """
    Adaptive line-plot of API / WEB / PostgreSQL latency.

    WEB uses a prominent ◆ marker (drawn on top).
    API and PG use small · markers.
    Colors: API=red, WEB=blue, PG=green  (WEB/PG swapped from original).
    Windows: 5m 15m 1h 3h 6h 12h 24h  — switch with keys 1–7.
    """

    # API red, WEB blue (swapped), PG green (swapped)
    COLORS  = {"api": "#e74c3c", "web": "#3b8beb", "pg": "#2ecc71"}
    WINDOWS = [
        ("5m",   5 * 60),
        ("15m",  15 * 60),
        ("1h",   1 * 3600),
        ("3h",   3 * 3600),
        ("6h",   6 * 3600),
        ("12h",  12 * 3600),
        ("24h",  24 * 3600),
    ]
    # 24 h at 10 s intervals = 8640 samples
    _MAXLEN = 8640

    def __init__(self, **kwargs) -> None:
        super().__init__(**kwargs)
        self._window_idx = 0
        self._history: deque[tuple[float, float | None, float | None, float | None]] = (
            deque(maxlen=self._MAXLEN)
        )

    # ── Public API ────────────────────────────────────────────────────────────

    def add_sample(
        self,
        api_ms: float | None,
        web_ms: float | None,
        pg_ms:  float | None,
    ) -> None:
        self._history.append((time.time(), api_ms, web_ms, pg_ms))
        self.refresh()

    def set_window(self, idx: int) -> None:
        self._window_idx = max(0, min(idx, len(self.WINDOWS) - 1))
        self.refresh()

    # ── Rendering ─────────────────────────────────────────────────────────────

    def render(self) -> Text:
        cw = self.content_size.width
        ch = self.content_size.height
        if cw < 14 or ch < 4:
            return Text(" …", style="dim")

        # y-axis label " XXXX ms│" = 9 chars  →  plot_w = cw - 9
        # rows: title(1) + legend(1) + plot(plot_h) + x-axis(1) = ch
        plot_w = max(cw - 9, 6)
        plot_h = max(ch - 3, 2)

        wlabel, secs = self.WINDOWS[self._window_idx]
        since = time.time() - secs
        pts   = [(ts, a, w, p) for ts, a, w, p in self._history if ts >= since]

        data: dict[str, list[float]] = {
            "api": [a for _, a, _, _ in pts if a is not None],
            "web": [w for _, _, w, _ in pts if w is not None],
            "pg":  [p for _, _, _, p in pts if p is not None],
        }

        out = Text()

        # ── Title / window selector ───────────────────────────────────────────
        out.append(" LATENCY  ", style="bold #c0392b")
        for i, (wl, _) in enumerate(self.WINDOWS):
            if i == self._window_idx:
                out.append(f" {wl} ", style="bold white on #8b0000")
            else:
                out.append(f" {wl} ", style="dim")
        out.append("  [dim]1-7[/]\n")

        # ── Legend ────────────────────────────────────────────────────────────
        out.append("  ")
        markers = {"api": "·", "web": "◆", "pg": "·"}
        for svc in ("api", "web", "pg"):
            last = data[svc][-1] if data[svc] else None
            val  = f"{last:.0f}ms" if last is not None else "—"
            out.append(f"{markers[svc]} ", style=self.COLORS[svc])
            out.append(f"{svc.upper()} ", style="dim")
            out.append(f"{val}  ", style=self.COLORS[svc])
        out.append("\n")

        # ── Plot ──────────────────────────────────────────────────────────────
        for line in self._build_plot(data, plot_w, plot_h):
            out.append_text(line)
            out.append("\n")

        return out

    # ── Plot builder ──────────────────────────────────────────────────────────

    def _build_plot(
        self,
        data:   dict[str, list[float]],
        width:  int,
        height: int,
    ) -> list[Text]:
        all_vals = [v for series in data.values() for v in series]

        if not all_vals:
            # Distinguish: no history at all vs. window simply has no data yet
            wlabel, _ = self.WINDOWS[self._window_idx]
            if not self._history:
                msg = "waiting for first sample…"
            else:
                msg = f"no data in {wlabel} window yet"
            lines: list[Text] = []
            mid = height // 2
            for row in range(height):
                t = Text("         │", style="dim")
                t.append(f" {msg}" if row == mid else " " * width)
                lines.append(t)
            lines.append(Text(f"         └{'─' * width}", style="dim"))
            return lines

        # Scale: top = max × 1.1, floor at 20 ms
        max_ms = max(max(all_vals) * 1.1, 20.0)

        def _resample(vals: list[float]) -> list[float | None]:
            if not vals:
                return [None] * width
            n = len(vals)
            if n >= width:
                step = n / width
                return [vals[min(n - 1, int(i * step))] for i in range(width)]
            result: list[float | None] = [None] * width
            for i, v in enumerate(vals):
                x = round(i / max(n - 1, 1) * (width - 1))
                result[min(x, width - 1)] = v
            return result

        resampled = {k: _resample(v) for k, v in data.items()}

        Cell = tuple[str, str]
        grid: list[list[Cell | None]] = [[None] * width for _ in range(height)]

        # Draw order: api and pg first (lowest priority), web last (on top)
        markers = {"api": "·", "web": "◆", "pg": "·"}
        draw_order = [
            ("api", self.COLORS["api"]),
            ("pg",  self.COLORS["pg"]),
            ("web", self.COLORS["web"]),   # drawn last → highest priority
        ]
        for svc, color in draw_order:
            vals   = resampled.get(svc, [None] * width)
            marker = markers[svc]
            prev_y: int | None = None
            for x, v in enumerate(vals):
                if v is None:
                    prev_y = None
                    continue
                y = max(0, min(height - 1,
                               round((1.0 - v / max_ms) * (height - 1))))

                # Vertical connector between non-adjacent rows
                if prev_y is not None and abs(y - prev_y) > 1:
                    lo, hi = min(prev_y, y), max(prev_y, y)
                    for fy in range(lo, hi + 1):
                        if grid[fy][x] is None:
                            grid[fy][x] = ("│", color)

                grid[y][x] = (marker, color)
                prev_y = y

        # Assemble with y-axis labels
        lines = []
        for row in range(height):
            ms_val = max_ms * (height - 1 - row) / max(height - 1, 1)
            lbl    = Text(f" {int(ms_val):4d}ms│", style="dim")
            for col in range(width):
                cell = grid[row][col]
                lbl.append(cell[0], style=cell[1]) if cell else lbl.append(" ")
            lines.append(lbl)

        lines.append(Text(f"         └{'─' * width}", style="dim"))
        return lines


class ClockLabel(Static):
    """Self-ticking clock."""

    def on_mount(self) -> None:
        self.set_interval(1, self._tick)
        self._tick()

    def _tick(self) -> None:
        self.update(datetime.now().strftime("[dim]%Y-%m-%d  [/][bold dim]%H:%M:%S[/]"))


# ── Stylesheet ────────────────────────────────────────────────────────────────

_CSS = """\
Screen {
    background: #080808;
}

/* ─ Header ─────────────────────────────────────────────── */
#topbar {
    dock: top;
    height: 3;
    background: #0c0c0c;
    border-bottom: solid #202020;
    padding: 0 2;
    align: left middle;
}
#title {
    color: #c0392b;
    text-style: bold;
    width: 1fr;
}
#clock { width: auto; }

/* ─ Service cards ───────────────────────────────────────── */
#cards {
    height: 8;
    margin: 1 1 0 1;
}
ServiceCard {
    width: 1fr;
    border: solid #1e1e1e;
    background: #0d0d0d;
    padding: 0 1;
    margin: 0 1 0 0;
    color: #c8c8c8;
}
ServiceCard:last-of-type { margin-right: 0; }

/* ─ System + Latency row (half / half) ──────────────────── */
#sys-lat {
    height: 13;
    margin: 1 1 0 1;
}
SysPanel {
    width: 1fr;
    height: 1fr;
    border: solid #1e1e1e;
    background: #0d0d0d;
    margin: 0 1 0 0;
    color: #c8c8c8;
}
LatencyPanel {
    width: 1fr;
    height: 1fr;
    border: solid #1e1e1e;
    background: #0d0d0d;
    color: #c8c8c8;
}

/* ─ Visitor section ─────────────────────────────────────── */
#vis-outer {
    border: solid #1e1e1e;
    background: #0a0a0a;
    margin: 1 1 1 1;
    height: 1fr;
}
#vis-bar {
    height: 2;
    background: #0f0f0f;
    border-bottom: solid #1e1e1e;
    padding: 0 2;
    align: left middle;
}
#vis-title {
    color: #c0392b;
    text-style: bold;
    width: auto;
}
#vis-meta {
    color: #3a3a3a;
    margin-left: 2;
}
DataTable {
    height: 1fr;
    background: #0a0a0a;
}

/* ─ Footer ──────────────────────────────────────────────── */
Footer {
    background: #0c0c0c;
    color: #444;
    border-top: solid #1e1e1e;
}
"""

# ── App ───────────────────────────────────────────────────────────────────────

class VocaRankMonitor(App):
    """VocaRank real-time TUI monitoring dashboard."""

    CSS = _CSS

    BINDINGS = [
        Binding("r", "refresh_now", "Refresh"),
        Binding("1", "window_0",    "5m",  show=False),
        Binding("2", "window_1",    "15m", show=False),
        Binding("3", "window_2",    "1h",  show=False),
        Binding("4", "window_3",    "3h",  show=False),
        Binding("5", "window_4",    "6h",  show=False),
        Binding("6", "window_5",    "12h", show=False),
        Binding("7", "window_6",    "24h", show=False),
        Binding("q", "quit",        "Quit"),
    ]

    # ── Layout ───────────────────────────────────────────────────────────────

    def compose(self) -> ComposeResult:
        with Horizontal(id="topbar"):
            yield Label("⟡  VOCARANK MONITOR", id="title")
            yield ClockLabel(id="clock")

        with Horizontal(id="cards"):
            yield ServiceCard("API",        "localhost:8000", id="c-api")
            yield ServiceCard("WEB",        "localhost:3000", id="c-web")
            yield ServiceCard("PostgreSQL", "localhost:5432", id="c-pg")

        with Horizontal(id="sys-lat"):
            yield SysPanel(id="sys")
            yield LatencyPanel(id="lat")

        with Vertical(id="vis-outer"):
            with Horizontal(id="vis-bar"):
                yield Label("VISITOR ACTIVITY", id="vis-title")
                yield Label("", id="vis-meta")
            yield DataTable(
                id="vis-tbl",
                zebra_stripes=True,
                cursor_type="row",
                show_cursor=True,
            )

        yield Footer()

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    async def on_mount(self) -> None:
        tbl = self.query_one("#vis-tbl", DataTable)
        tbl.add_column("TIME (LOCAL)",  width=11)
        tbl.add_column("IP ADDRESS",    width=17)
        tbl.add_column("COUNTRY",       width=16)
        tbl.add_column("PAGE / ACTION", width=28)
        tbl.add_column("TYPE",          width=6)

        self.set_interval(INTERVAL_SVC, self._refresh_services)
        self.set_interval(INTERVAL_SYS, self._refresh_system)
        self.set_interval(INTERVAL_VIS, self._refresh_visitors)

        self._refresh_system()
        await asyncio.gather(
            self._refresh_services(),
            self._refresh_visitors(),
        )

    # ── Actions ───────────────────────────────────────────────────────────────

    async def action_refresh_now(self) -> None:
        self._refresh_system()
        await asyncio.gather(
            self._refresh_services(),
            self._refresh_visitors(),
        )

    def action_window_0(self) -> None: self.query_one("#lat", LatencyPanel).set_window(0)
    def action_window_1(self) -> None: self.query_one("#lat", LatencyPanel).set_window(1)
    def action_window_2(self) -> None: self.query_one("#lat", LatencyPanel).set_window(2)
    def action_window_3(self) -> None: self.query_one("#lat", LatencyPanel).set_window(3)
    def action_window_4(self) -> None: self.query_one("#lat", LatencyPanel).set_window(4)
    def action_window_5(self) -> None: self.query_one("#lat", LatencyPanel).set_window(5)
    def action_window_6(self) -> None: self.query_one("#lat", LatencyPanel).set_window(6)

    # ── Refresh helpers ───────────────────────────────────────────────────────

    async def _refresh_services(self) -> None:
        api, web, pg = await asyncio.gather(
            asyncio.to_thread(_check_api),
            asyncio.to_thread(_check_web),
            asyncio.to_thread(_check_pg),
        )
        self.query_one("#c-api", ServiceCard).apply(api)
        self.query_one("#c-web", ServiceCard).apply(web)
        self.query_one("#c-pg",  ServiceCard).apply(pg)

        self.query_one("#lat", LatencyPanel).add_sample(
            api.get("ms") if api.get("ok") else None,
            web.get("ms") if web.get("ok") else None,
            pg.get("ms")  if pg.get("ok")  else None,
        )

    def _refresh_system(self) -> None:
        self.query_one("#sys", SysPanel).tick()

    async def _refresh_visitors(self) -> None:
        rows = await asyncio.to_thread(_fetch_visitors)
        self._render_visitors(rows)

    def _render_visitors(self, rows: list[dict]) -> None:
        now = datetime.now().strftime("%H:%M:%S")
        self.query_one("#vis-meta", Label).update(
            f"[dim]— last {VIS_LIMIT} entries, updated {now}[/]"
        )

        tbl = self.query_one("#vis-tbl", DataTable)
        tbl.clear()

        if not rows:
            tbl.add_row(
                Text("—", style="dim"),
                Text("—", style="dim"),
                Text("—", style="dim"),
                Text("No visitor data (DB may be unreachable)", style="dim italic"),
                Text("—", style="dim"),
            )
            return

        for r in rows:
            ts      = _utc_to_local_hms(r["ts"])
            ip      = r["ip"] or "—"
            country = r.get("country", "")
            page    = r["page"] or "—"
            kind    = r["kind"]

            ip_txt = Text(ip, style="dim" if _is_internal(ip) else "white")

            if not country:
                ctry_txt = Text("—", style="dim")
            elif country == "Unknown":
                ctry_txt = Text("Unknown", style="dim yellow")
            else:
                ctry_txt = Text(country, style="#4a90d9")

            if kind == "vote":
                kind_txt = Text("vote", style="bold yellow")
                page_txt = Text(f"♥  {page}", style="yellow")
            else:
                kind_txt = Text("view", style="bold #4a90d9")
                page_txt = Text(page, style="#8899bb")

            tbl.add_row(ts, ip_txt, ctry_txt, page_txt, kind_txt)


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    VocaRankMonitor().run()

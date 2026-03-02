#!/usr/bin/env python3
"""
VocaRank Monitor — Real-time TUI dashboard.

Shows:
  • API / Web / PostgreSQL health (latency, status)
  • CPU, RAM, network throughput (Mbps / Kbps)
  • Recent visitor activity from the database

Usage (from repo root):
    python3 monitor/monitor.py

Keys:
  r  — force immediate refresh
  q  — quit
"""
from __future__ import annotations

import asyncio
import os
import time
from datetime import datetime
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
VIS_LIMIT    = 50   # max rows in visitor table

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

def _bar(pct: float, width: int = 26) -> str:
    filled = round(pct / 100 * width)
    return "█" * filled + "░" * (width - filled)

def _extract_hms(ts: str) -> str:
    """Return HH:MM:SS from any datetime string."""
    ts = ts.strip().replace("T", " ")
    return ts[11:19] if len(ts) >= 19 else (ts[-8:] if len(ts) >= 8 else ts)

def _is_internal(ip: str) -> bool:
    return ip.startswith(("10.", "192.168.", "127.", "::1", "172.1", "172.2", "172.3"))

# ── Network throughput tracker ────────────────────────────────────────────────

class _NetTracker:
    def __init__(self) -> None:
        c = psutil.net_io_counters()
        self._t = time.monotonic()
        self._s = c.bytes_sent
        self._r = c.bytes_recv

    def sample(self) -> tuple[float, float]:
        c  = psutil.net_io_counters()
        dt = max(time.monotonic() - self._t, 1e-6)
        up = (c.bytes_sent - self._s) / dt
        dn = (c.bytes_recv - self._r) / dt
        self._t, self._s, self._r = time.monotonic(), c.bytes_sent, c.bytes_recv
        return up, dn

_NET = _NetTracker()

# ── Blocking data-fetchers (run via asyncio.to_thread) ───────────────────────

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
            SELECT created_at, ip_address, vote_type,  'vote'
              FROM song_votes
            ORDER BY 1 DESC
            LIMIT %s
        """, (limit,))
        rows = cur.fetchall()
        conn.close()
        return [{"ts": r[0], "ip": r[1], "page": r[2], "kind": r[3]} for r in rows]
    except Exception:
        return []

# ── Widgets ───────────────────────────────────────────────────────────────────

class ServiceCard(Static):
    """Health panel for one backend service."""

    BORDER_TITLE = ""   # will be set in __init__

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
                f"[dim]pg[/] {r['version']}  "
                f"[dim]·[/]  {r.get('songs', '?')} songs  "
                f"[dim]·[/]  {r.get('users', '?')} users"
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
    """CPU, RAM, and network throughput."""

    def tick(self) -> None:
        cpu = psutil.cpu_percent()
        mem = psutil.virtual_memory()
        up, dn = _NET.sample()

        cpu_c = "red"    if cpu        > 80 else ("yellow" if cpu        > 50 else "green")
        ram_c = "red"    if mem.percent > 85 else ("yellow" if mem.percent > 65 else "cyan")

        ru = mem.used  / 1024 ** 3
        rt = mem.total / 1024 ** 3

        self.update(
            f"\n"
            f"  CPU   [{cpu_c}]{_bar(cpu)}[/]  [{cpu_c}]{cpu:5.1f}%[/]\n"
            f"  RAM   [{ram_c}]{_bar(mem.percent)}[/]  [{ram_c}]{ru:.1f}[/][dim] / {rt:.1f} GB[/]\n"
            f"\n"
            f"  NET   [bold green]↑ {_fmt_speed(up)}[/]      [bold cyan]↓ {_fmt_speed(dn)}[/]"
        )


class ClockLabel(Static):
    """Self-ticking clock in the header."""

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
#clock {
    width: auto;
}

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
ServiceCard:last-of-type {
    margin-right: 0;
}

/* ─ System panel ────────────────────────────────────────── */
SysPanel {
    height: 7;
    border: solid #1e1e1e;
    background: #0d0d0d;
    margin: 1 1 0 1;
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
    """VocaRank real-time monitoring TUI."""

    CSS = _CSS

    BINDINGS = [
        Binding("r", "refresh_now", "Refresh"),
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

        yield SysPanel(id="sys")

        with Vertical(id="vis-outer"):
            with Horizontal(id="vis-bar"):
                yield Label("VISITOR ACTIVITY", id="vis-title")
                yield Label(
                    f"— last {VIS_LIMIT} entries, auto-refresh {INTERVAL_VIS}s",
                    id="vis-meta",
                )
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
        tbl.add_column("TIME",          width=10)
        tbl.add_column("IP ADDRESS",    width=18)
        tbl.add_column("PAGE / ACTION", width=34)
        tbl.add_column("TYPE",          width=6)

        # Start recurring timers
        self.set_interval(INTERVAL_SVC, self._refresh_services)
        self.set_interval(INTERVAL_SYS, self._refresh_system)
        self.set_interval(INTERVAL_VIS, self._refresh_visitors)

        # Immediate initial load (all three in parallel)
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

    # ── Refresh coroutines ────────────────────────────────────────────────────

    async def _refresh_services(self) -> None:
        api, web, pg = await asyncio.gather(
            asyncio.to_thread(_check_api),
            asyncio.to_thread(_check_web),
            asyncio.to_thread(_check_pg),
        )
        self.query_one("#c-api", ServiceCard).apply(api)
        self.query_one("#c-web", ServiceCard).apply(web)
        self.query_one("#c-pg",  ServiceCard).apply(pg)

    def _refresh_system(self) -> None:
        self.query_one("#sys", SysPanel).tick()

    async def _refresh_visitors(self) -> None:
        rows = await asyncio.to_thread(_fetch_visitors)
        self._render_visitors(rows)

    # ── Render helpers ────────────────────────────────────────────────────────

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
                Text("No visitor data (DB may be unreachable)", style="dim italic"),
                Text("—", style="dim"),
            )
            return

        for r in rows:
            ts   = _extract_hms(r["ts"])
            ip   = r["ip"] or "—"
            page = r["page"] or "—"
            kind = r["kind"]

            ip_txt = Text(ip, style="dim" if _is_internal(ip) else "white")

            if kind == "vote":
                kind_txt = Text("vote", style="bold yellow")
                page_txt = Text(f"♥  {page}", style="yellow")
            else:
                kind_txt = Text("view", style="bold #4a90d9")
                page_txt = Text(page, style="#8899bb")

            tbl.add_row(ts, ip_txt, page_txt, kind_txt)


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    VocaRankMonitor().run()

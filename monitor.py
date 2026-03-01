#!/usr/bin/env python3
"""
VocaRank TUI Monitor
Run: python3 monitor.py
"""

# ─────────────────────────────────────────────────────────────
# USER-EDITABLE CONFIG
# ─────────────────────────────────────────────────────────────
CONFIG = {
    # tmux session names — edit to match your actual session names
    "tmux_api_session":  "vocarank-api",
    "tmux_npm_session":  "vocarank-web",
    # Start commands (used when starting via TUI)
    "api_cmd":           "uvicorn api.main:app --host 0.0.0.0 --port 8000",
    "npm_dev_cmd":       "npm run dev",
    "npm_prod_cmd":      "npm run build && npm start",
    # Paths
    "project_dir":       "/home/yozorua/VocaRank",
    "website_dir":       "/home/yozorua/VocaRank/website",
    "log_file":          "/home/yozorua/VocaRank/logs/cron.log",
    # Ports
    "api_port":          8000,
    "frontend_port":     3000,
    # Script batch sizes
    "update_songs_n":    10000,
    "update_artists_n":  10000,
}

# ─────────────────────────────────────────────────────────────
# IMPORTS
# ─────────────────────────────────────────────────────────────
import subprocess
import time
from pathlib import Path

try:
    import psutil
except ImportError:
    psutil = None

try:
    import requests as _requests
except ImportError:
    _requests = None

from rich.text import Text as RichText

from textual.app import App, ComposeResult
from textual.binding import Binding
from textual.containers import Horizontal, Vertical, VerticalScroll
from textual.screen import ModalScreen
from textual.widgets import (
    Button,
    Footer,
    Header,
    Input,
    Label,
    Static,
    TabbedContent,
    TabPane,
)
from textual import work


# ─────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────

def fmt_rate(n_bytes_per_sec: float) -> str:
    """Format bytes/sec as Mbps or Kbps."""
    bits = n_bytes_per_sec * 8
    if bits >= 1_000_000:
        return f"{bits / 1_000_000:.1f} Mbps"
    if bits >= 1_000:
        return f"{bits / 1_000:.0f} Kbps"
    return "< 1 Kbps"


def run_cmd(args: list[str], **kwargs) -> subprocess.CompletedProcess:
    return subprocess.run(args, capture_output=True, text=True, **kwargs)


def tmux_capture(session: str) -> str:
    r = run_cmd(["tmux", "capture-pane", "-pJ", "-t", session, "-S", "-200"])
    if r.returncode != 0:
        return f"[Session '{session}' not found]\nEdit CONFIG at top of monitor.py"
    return r.stdout


def check_http(url: str) -> bool:
    if _requests is None:
        return False
    try:
        return _requests.get(url, timeout=2).status_code < 500
    except Exception:
        return False


def check_postgres() -> bool:
    return run_cmd(["pg_isready", "-h", "localhost"]).returncode == 0


def read_log_file(path: str, lines: int = 200) -> str:
    p = Path(path)
    if not p.exists():
        return f"Log file not found: {path}"
    try:
        all_lines = p.read_text(errors="replace").splitlines()
        return "\n".join(all_lines[-lines:])
    except Exception as e:
        return f"Error reading log: {e}"


# ─────────────────────────────────────────────────────────────
# MODALS
# ─────────────────────────────────────────────────────────────

_MODAL_CSS = """
.modal-box {
    background: $surface;
    padding: 1 2;
    width: 60;
    height: auto;
    border: thick $primary;
}
.modal-box Label  { width: 100%; margin-bottom: 1; }
.modal-box Input  { margin-bottom: 1; }
.modal-btns { align: center middle; width: 100%; height: auto; }
.modal-btns Button { margin: 0 1; }
"""


class ConfirmModal(ModalScreen):
    DEFAULT_CSS = _MODAL_CSS + "ConfirmModal { align: center middle; }"

    def __init__(self, message: str) -> None:
        super().__init__()
        self._message = message

    def compose(self) -> ComposeResult:
        with Vertical(classes="modal-box"):
            yield Label(self._message)
            with Horizontal(classes="modal-btns"):
                yield Button("Yes", id="yes", variant="error")
                yield Button("No",  id="no",  variant="default")

    def on_button_pressed(self, event: Button.Pressed) -> None:
        self.dismiss(event.button.id == "yes")

    def on_key(self, event) -> None:
        if event.key == "escape":
            self.dismiss(False)


class SudoPasswordModal(ModalScreen):
    DEFAULT_CSS = _MODAL_CSS + "SudoPasswordModal { align: center middle; }"

    def __init__(self, action: str = "operate") -> None:
        super().__init__()
        self._action = action

    def compose(self) -> ComposeResult:
        with Vertical(classes="modal-box"):
            yield Label(f"Enter sudo password to {self._action} PostgreSQL:")
            yield Input(placeholder="password", password=True, id="pw-input")
            with Horizontal(classes="modal-btns"):
                yield Button("Run",    id="run",    variant="warning")
                yield Button("Cancel", id="cancel", variant="default")

    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "run":
            pw = self.query_one("#pw-input", Input).value
            self.dismiss(pw if pw else None)
        else:
            self.dismiss(None)

    def on_key(self, event) -> None:
        if event.key == "escape":
            self.dismiss(None)


class InputModal(ModalScreen):
    DEFAULT_CSS = _MODAL_CSS + "InputModal { align: center middle; }"

    def __init__(self, title: str, placeholder: str = "Enter value") -> None:
        super().__init__()
        self._title = title
        self._placeholder = placeholder

    def compose(self) -> ComposeResult:
        with Vertical(classes="modal-box"):
            yield Label(self._title)
            yield Input(placeholder=self._placeholder, id="id-input")
            with Horizontal(classes="modal-btns"):
                yield Button("OK",     id="ok",     variant="primary")
                yield Button("Cancel", id="cancel", variant="default")

    def on_button_pressed(self, event: Button.Pressed) -> None:
        if event.button.id == "ok":
            val = self.query_one("#id-input", Input).value.strip()
            self.dismiss(val if val else None)
        else:
            self.dismiss(None)

    def on_key(self, event) -> None:
        if event.key == "enter":
            val = self.query_one("#id-input", Input).value.strip()
            self.dismiss(val if val else None)
        elif event.key == "escape":
            self.dismiss(None)


# ─────────────────────────────────────────────────────────────
# SERVICE STATE BADGES
# ─────────────────────────────────────────────────────────────

_BADGE = {
    "UP":       "[bold green]● UP      [/]",
    "DOWN":     "[bold red]● DOWN    [/]",
    "STARTING": "[bold yellow]● STARTING[/]",
    "STOPPING": "[bold yellow]● STOPPING[/]",
    "CHECKING": "[dim]● …       [/]",
}


# ─────────────────────────────────────────────────────────────
# MAIN APP
# ─────────────────────────────────────────────────────────────

class VocaRankMonitor(App):

    TITLE = "VocaRank Monitor"

    BINDINGS = [
        Binding("q", "quit", "Quit", priority=True),
        Binding("1", "switch_tab('log-tab')", "1:Log"),
        Binding("2", "switch_tab('api-tab')", "2:API"),
        Binding("3", "switch_tab('web-tab')", "3:Web"),
        Binding("a", "toggle_actions", "A:Actions"),
    ]

    CSS = """
    Screen { layout: vertical; }

    /* ── top row ─── */
    #top-row { layout: horizontal; height: auto; }

    #service-panel {
        border: round $primary;
        padding: 0 1;
        width: 1fr;
        height: auto;
    }
    .panel-title { text-style: bold; }

    /* Service rows — compact 3-cell rows, buttons with no vertical padding */
    .svc-row        { height: 3; align: left middle; }
    .svc-badge      { width: 12; }
    .svc-name       { width: 22; }
    .svc-row Button { margin-right: 1; min-width: 10; padding: 0 1; }

    /* ── system panel ─── */
    #system-panel {
        border: round $accent;
        padding: 0 1;
        width: 36;
        height: auto;
        margin-left: 1;
    }
    #sys-metrics { height: auto; }

    /* ── log area ─── */
    #log-area    { border: round $secondary; height: 1fr; }
    TabbedContent { height: 100%; }
    TabPane       { height: 100%; padding: 0; }
    VerticalScroll { height: 100%; }
    .log-static   { padding: 0 1; height: auto; }

    /* ── actions panel ─── */
    #actions-header { height: 1; align: left middle; }
    #actions-toggle { min-width: 4; width: 4; margin-left: 1; }
    #actions-body   { height: auto; display: block; }
    #actions-body.hidden { display: none; }
    #actions-panel { border: round $warning; padding: 0 1; height: auto; }
    /* Action rows — compact */
    .act-row        { height: 3; align: left middle; }
    .act-label      { width: 8; text-style: bold; }
    .act-row Button { margin-right: 1; min-width: 14; }
    """

    def __init__(self) -> None:
        super().__init__()
        self._svc_states: dict[str, str] = {
            "api": "CHECKING", "web": "CHECKING", "pg": "CHECKING"
        }
        self._active_log_tab: str = "log-tab"
        self._last_net: tuple | None = None
        self._last_net_up: float = 0.0
        self._last_net_dn: float = 0.0
        self._actions_visible: bool = True

    # ── Layout ───────────────────────────────────────────────

    def compose(self) -> ComposeResult:
        yield Header(show_clock=True)

        with Horizontal(id="top-row"):
            with Vertical(id="service-panel"):
                yield Label("SERVICES", classes="panel-title")

                with Horizontal(classes="svc-row"):
                    yield Static("", id="badge-api", classes="svc-badge")
                    yield Static(f"API  :{CONFIG['api_port']}", classes="svc-name")
                    yield Button("Start", id="btn-start-api", variant="primary")
                    yield Button("Stop",  id="btn-stop-api",  variant="error")

                with Horizontal(classes="svc-row"):
                    yield Static("", id="badge-web", classes="svc-badge")
                    yield Static(f"Web  :{CONFIG['frontend_port']}", classes="svc-name")
                    yield Button("Dev",  id="btn-start-web-dev",  variant="primary")
                    yield Button("Prod", id="btn-start-web-prod", variant="primary")
                    yield Button("Stop", id="btn-stop-web",       variant="error")

                with Horizontal(classes="svc-row"):
                    yield Static("", id="badge-pg", classes="svc-badge")
                    yield Static("PostgreSQL", classes="svc-name")
                    yield Button("Start", id="btn-start-pg", variant="primary")
                    yield Button("Stop",  id="btn-stop-pg",  variant="error")

            with Vertical(id="system-panel"):
                yield Label("SYSTEM", classes="panel-title")
                yield Static("Collecting…", id="sys-metrics")

        with TabbedContent(id="log-area", initial="log-tab"):
            with TabPane("1: Log", id="log-tab"):
                with VerticalScroll(id="scroll-log"):
                    yield Static("", id="slog-log", classes="log-static")
            with TabPane("2: API", id="api-tab"):
                with VerticalScroll(id="scroll-api"):
                    yield Static("", id="slog-api", classes="log-static")
            with TabPane("3: Web", id="web-tab"):
                with VerticalScroll(id="scroll-web"):
                    yield Static("", id="slog-web", classes="log-static")

        with Vertical(id="actions-panel"):
            with Horizontal(id="actions-header"):
                yield Label("ACTIONS", classes="panel-title")
                yield Button("▲", id="actions-toggle", variant="default")

            with Vertical(id="actions-body"):
                with Horizontal(classes="act-row"):
                    yield Label("Bulk", classes="act-label")
                    yield Button("Fetch New",    id="btn-fetch-new",   variant="success")
                    yield Button("Upd Songs",    id="btn-upd-songs",   variant="success")
                    yield Button("Upd Newest",   id="btn-upd-newest",  variant="success")
                    yield Button("Upd Artists",  id="btn-upd-artists", variant="success")

                with Horizontal(classes="act-row"):
                    yield Label("By ID", classes="act-label")
                    yield Button("Upd Song ID",   id="btn-upd-song-id",   variant="primary")
                    yield Button("Fetch Views ID", id="btn-views-song-id", variant="primary")

                with Horizontal(classes="act-row"):
                    yield Label("Views", classes="act-label")
                    yield Button("All Views",    id="btn-views-all", variant="success")
                    yield Button("Pop Views",    id="btn-views-pop", variant="success")
                    yield Button("Rankings",     id="btn-rankings",  variant="warning")

        yield Footer()

    # ── Lifecycle ─────────────────────────────────────────────

    def on_mount(self) -> None:
        if psutil:
            psutil.cpu_percent(interval=None)  # seed so first reading isn't 0
        for svc in ("api", "web", "pg"):
            self._apply_svc_state(svc, "CHECKING")
        self.set_interval(2, self._update_metrics)
        self.set_interval(5, self._trigger_health_check)
        self.set_interval(2, self._refresh_active_log)
        self._trigger_health_check()
        self._update_metrics()
        # Defer first log write until after first render cycle
        self.call_after_refresh(self._refresh_active_log)

    # ── Service state ─────────────────────────────────────────

    def _apply_svc_state(self, svc: str, state: str) -> None:
        self._svc_states[svc] = state
        self.query_one(f"#badge-{svc}", Static).update(_BADGE.get(state, "[dim]●[/]"))
        up_ish   = state in ("UP",   "STARTING")
        down_ish = state in ("DOWN", "STOPPING")
        if svc == "api":
            self.query_one("#btn-start-api").disabled = up_ish
            self.query_one("#btn-stop-api").disabled  = down_ish
        elif svc == "web":
            self.query_one("#btn-start-web-dev").disabled  = up_ish
            self.query_one("#btn-start-web-prod").disabled = up_ish
            self.query_one("#btn-stop-web").disabled       = down_ish
        elif svc == "pg":
            self.query_one("#btn-start-pg").disabled = up_ish
            self.query_one("#btn-stop-pg").disabled  = down_ish

    # ── Health check ──────────────────────────────────────────

    def _trigger_health_check(self) -> None:
        self._run_health_check()

    @work(thread=True, exclusive=True)
    def _run_health_check(self) -> None:
        api_up = check_http(f"http://localhost:{CONFIG['api_port']}/health")
        web_up = check_http(f"http://localhost:{CONFIG['frontend_port']}")
        pg_up  = check_postgres()

        def apply() -> None:
            if self._svc_states["api"] not in ("STARTING", "STOPPING"):
                self._apply_svc_state("api", "UP" if api_up else "DOWN")
            if self._svc_states["web"] not in ("STARTING", "STOPPING"):
                self._apply_svc_state("web", "UP" if web_up else "DOWN")
            if self._svc_states["pg"] not in ("STARTING", "STOPPING"):
                self._apply_svc_state("pg", "UP" if pg_up else "DOWN")

        self.call_from_thread(apply)

    # ── System metrics ────────────────────────────────────────

    def _update_metrics(self) -> None:
        if psutil is None:
            self.query_one("#sys-metrics", Static).update(
                "psutil not installed\npip3 install psutil"
            )
            return

        cpu = psutil.cpu_percent(interval=None)
        vm  = psutil.virtual_memory()
        used_gb  = vm.used  / 1024 ** 3
        total_gb = vm.total / 1024 ** 3

        # Network delta
        now = time.monotonic()
        net = psutil.net_io_counters()
        if self._last_net is not None:
            ps, pr, pt = self._last_net
            dt = now - pt
            if dt > 0:
                self._last_net_up = (net.bytes_sent - ps) / dt
                self._last_net_dn = (net.bytes_recv - pr) / dt
        self._last_net = (net.bytes_sent, net.bytes_recv, now)

        up_str = fmt_rate(self._last_net_up) if self._last_net else "—"
        dn_str = fmt_rate(self._last_net_dn) if self._last_net else "—"

        text = (
            f"CPU  {cpu:.0f}%\n"
            f"RAM  {vm.percent:.0f}%   {used_gb:.1f} / {total_gb:.1f} GB\n"
            f"Net  {up_str} ↑\n"
            f"Net  {dn_str} ↓"
        )
        self.query_one("#sys-metrics", Static).update(text)

    # ── Log refresh ───────────────────────────────────────────

    def _refresh_active_log(self) -> None:
        tab = self._active_log_tab
        if tab == "log-tab":
            self._write_log("slog-log", "scroll-log", read_log_file(CONFIG["log_file"]))
        elif tab == "api-tab":
            self._write_log("slog-api", "scroll-api", tmux_capture(CONFIG["tmux_api_session"]))
        elif tab == "web-tab":
            self._write_log("slog-web", "scroll-web", tmux_capture(CONFIG["tmux_npm_session"]))

    def _write_log(self, static_id: str, scroll_id: str, text: str) -> None:
        try:
            # from_ansi handles ANSI color codes (e.g. \x1b[94m) AND avoids
            # markup-parsing issues — the result is a plain Rich Text object.
            self.query_one(f"#{static_id}", Static).update(RichText.from_ansi(text))
            self.query_one(f"#{scroll_id}", VerticalScroll).scroll_end(animate=False)
        except Exception:
            pass

    # ── Tab switching ─────────────────────────────────────────

    def action_switch_tab(self, tab_id: str) -> None:
        self._active_log_tab = tab_id
        self.query_one("#log-area", TabbedContent).active = tab_id
        # Defer write so the pane is fully rendered first
        self.call_after_refresh(self._refresh_active_log)

    def on_tabbed_content_tab_activated(self, event: TabbedContent.TabActivated) -> None:
        pane_id = self.query_one("#log-area", TabbedContent).active
        if pane_id:
            self._active_log_tab = pane_id
            self.call_after_refresh(self._refresh_active_log)

    # ── Button dispatcher ─────────────────────────────────────

    def action_toggle_actions(self) -> None:
        """Toggle the actions body via the 'a' key binding."""
        self._actions_visible = not self._actions_visible
        body   = self.query_one("#actions-body")
        toggle = self.query_one("#actions-toggle", Button)
        if self._actions_visible:
            body.remove_class("hidden")
            toggle.label = "▲"
        else:
            body.add_class("hidden")
            toggle.label = "▼"

    def on_button_pressed(self, event: Button.Pressed) -> None:
        b = event.button.id

        # Actions panel toggle button
        if b == "actions-toggle":
            self.action_toggle_actions()
            return

        # Service: API
        if b == "btn-start-api":
            self._confirm_then("Start API (uvicorn)?", self._do_start_api)
        elif b == "btn-stop-api":
            self._confirm_then("Stop API?", self._do_stop_api)
        # Service: Web
        elif b == "btn-start-web-dev":
            self._confirm_then("Start Web in DEV mode?",
                               lambda: self._do_start_web("dev"))
        elif b == "btn-start-web-prod":
            self._confirm_then("Start Web in PROD mode (build + start)?",
                               lambda: self._do_start_web("prod"))
        elif b == "btn-stop-web":
            self._confirm_then("Stop Web?", self._do_stop_web)
        # Service: PostgreSQL
        elif b == "btn-start-pg":
            self._confirm_then("Start PostgreSQL (requires sudo)?",
                               lambda: self._ask_sudo_pg("start"))
        elif b == "btn-stop-pg":
            self._confirm_then("Stop PostgreSQL (requires sudo)?",
                               lambda: self._ask_sudo_pg("stop"))
        # Bulk actions
        elif b == "btn-fetch-new":
            self._run_script("fetch-new", "Fetch New Songs")
        elif b == "btn-upd-songs":
            n = CONFIG["update_songs_n"]
            self._run_script(f"update-existing --songs {n}", "Update Songs")
        elif b == "btn-upd-newest":
            n = CONFIG["update_songs_n"]
            self._run_script(f"update-existing --newest-songs {n}", "Update Newest Songs")
        elif b == "btn-upd-artists":
            n = CONFIG["update_artists_n"]
            self._run_script(f"update-existing --artists {n}", "Update Artists")
        # By-ID actions
        elif b == "btn-upd-song-id":
            self._ask_id("Enter Song ID to update:", "Song ID",
                         lambda sid: self._run_script(
                             f"update-existing --song {sid}", f"Update Song #{sid}"))
        elif b == "btn-views-song-id":
            self._ask_id("Enter Song ID to fetch views:", "Song ID",
                         lambda sid: self._run_script(
                             f"views-song {sid}", f"Fetch Views Song #{sid}"))
        # Views / rankings
        elif b == "btn-views-all":
            self._run_script("views all", "Fetch All Views")
        elif b == "btn-views-pop":
            self._run_script("views popular", "Fetch Popular Views")
        elif b == "btn-rankings":
            self._run_script("rankings", "Calculate Rankings")

    # ── Confirm / input helpers ───────────────────────────────

    def _confirm_then(self, message: str, callback) -> None:
        def handle(confirmed: bool) -> None:
            if confirmed:
                callback()
        self.push_screen(ConfirmModal(message), handle)

    def _ask_id(self, title: str, placeholder: str, callback) -> None:
        def handle(value: str | None) -> None:
            if value is not None:
                callback(value)
        self.push_screen(InputModal(title, placeholder), handle)

    # ── Service: API ──────────────────────────────────────────

    def _do_start_api(self) -> None:
        self._apply_svc_state("api", "STARTING")
        run_cmd(["tmux", "kill-session", "-t", CONFIG["tmux_api_session"]])
        run_cmd(["tmux", "new-session", "-d",
                 "-s", CONFIG["tmux_api_session"],
                 "-c", CONFIG["project_dir"],
                 CONFIG["api_cmd"]])
        self.notify("API starting…", severity="information")

    def _do_stop_api(self) -> None:
        self._apply_svc_state("api", "STOPPING")
        run_cmd(["tmux", "kill-session", "-t", CONFIG["tmux_api_session"]])
        self.notify("API stopped.", severity="information")

    # ── Service: Web ──────────────────────────────────────────

    def _do_start_web(self, mode: str) -> None:
        self._apply_svc_state("web", "STARTING")
        cmd = CONFIG["npm_dev_cmd"] if mode == "dev" else CONFIG["npm_prod_cmd"]
        run_cmd(["tmux", "kill-session", "-t", CONFIG["tmux_npm_session"]])
        run_cmd(["tmux", "new-session", "-d",
                 "-s", CONFIG["tmux_npm_session"],
                 "-c", CONFIG["website_dir"],
                 cmd])
        self.notify(f"Web ({mode}) starting…", severity="information")

    def _do_stop_web(self) -> None:
        self._apply_svc_state("web", "STOPPING")
        run_cmd(["tmux", "kill-session", "-t", CONFIG["tmux_npm_session"]])
        self.notify("Web stopped.", severity="information")

    # ── Service: PostgreSQL ───────────────────────────────────

    def _ask_sudo_pg(self, action: str) -> None:
        def handle(pw: str | None) -> None:
            if pw is not None:
                self._do_pg_systemctl(action, pw)
        self.push_screen(SudoPasswordModal(action), handle)

    @work(thread=True)
    def _do_pg_systemctl(self, action: str, password: str) -> None:
        transitional = "STARTING" if action == "start" else "STOPPING"
        self.call_from_thread(self._apply_svc_state, "pg", transitional)
        proc = subprocess.run(
            ["sudo", "-S", "systemctl", action, "postgresql"],
            input=password + "\n",
            capture_output=True,
            text=True,
        )
        if proc.returncode == 0:
            self.call_from_thread(
                self.notify, f"PostgreSQL {action}ed.", severity="information"
            )
        else:
            err = proc.stderr.strip() or "Unknown error"
            self.call_from_thread(self._apply_svc_state, "pg", "CHECKING")
            self.call_from_thread(
                self.notify, f"PostgreSQL {action} failed: {err}", severity="error"
            )
        self.call_from_thread(self._trigger_health_check)

    # ── Script runner ─────────────────────────────────────────

    def _run_script(self, args: str, label: str) -> None:
        task_session = "vocarank-task"
        run_cmd(["tmux", "kill-session", "-t", task_session])
        run_cmd(["tmux", "new-session", "-d",
                 "-s", task_session,
                 "-c", CONFIG["project_dir"],
                 f"./run_vocarank.sh {args}"])
        self.notify(f"Started: {label}", severity="information")
        self.action_switch_tab("log-tab")


# ─────────────────────────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────────────────────────

if __name__ == "__main__":
    VocaRankMonitor().run()

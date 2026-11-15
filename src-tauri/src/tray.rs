use std::sync::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Instant;

use tauri::image::Image;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, WebviewWindow};

const TRAY_ID: &str = "tray";
const PANEL: &str = "panel";
const DAY: &str = "day";
const SIZE: usize = 32;

const TRACK: [u8; 4] = [70, 66, 62, 180];
const FOCUS: [u8; 4] = [224, 122, 76, 255];
const BREAK: [u8; 4] = [88, 150, 122, 255];
const OVERTIME: [u8; 4] = [224, 122, 76, 255];
const OVERTIME_DOT: [u8; 4] = [242, 196, 92, 255];

static QUITTING: AtomicBool = AtomicBool::new(false);
static TRAY_ANCHOR: Mutex<Option<(i32, i32, i32, i32)>> = Mutex::new(None);
static MENU_LABEL: Mutex<Option<Option<String>>> = Mutex::new(None);
static PANEL_SHOWN_AT: Mutex<Option<Instant>> = Mutex::new(None);

pub fn should_dismiss_panel(elapsed_ms: u128, cursor_on_tray: bool) -> bool {
    elapsed_ms >= 300 && !cursor_on_tray
}

pub fn cursor_in_tray_rect(x: f64, y: f64, rect: Option<(i32, i32, i32, i32)>) -> bool {
    let Some((left, top, width, height)) = rect else {
        return false;
    };
    if width <= 0 || height <= 0 {
        return false;
    }
    x >= left as f64
        && x < left as f64 + width as f64
        && y >= top as f64
        && y < top as f64 + height as f64
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TrayStatus {
    pub menu_bar_label: Option<String>,
    pub tooltip: String,
    pub ring_mode: String,
    pub ring_progress: f32,
    pub paused: bool,
    pub menu_pause_label: Option<String>,
}

pub fn ring_rgba(mode: &str, progress: f32) -> [u8; SIZE * SIZE * 4] {
    const CENTER: f32 = 15.5;
    const INNER: f32 = 10.0;
    const OUTER: f32 = 14.0;
    const DOT: f32 = 3.5;

    let progress = progress.clamp(0.0, 1.0);
    let (arc, sweep, dot) = match mode {
        "overtime" => (OVERTIME, 1.0, Some(OVERTIME_DOT)),
        "break" => (BREAK, progress, None),
        "idle" => (FOCUS, 0.0, None),
        _ => (FOCUS, progress, None),
    };

    let mut buf = [0u8; SIZE * SIZE * 4];
    for y in 0..SIZE {
        for x in 0..SIZE {
            let dx = x as f32 + 0.5 - CENTER;
            let dy = y as f32 + 0.5 - CENTER;
            let dist = (dx * dx + dy * dy).sqrt();
            let color = if (INNER..=OUTER).contains(&dist) {
                let mut theta = dx.atan2(-dy);
                if theta < 0.0 {
                    theta += std::f32::consts::TAU;
                }
                let on_arc =
                    sweep >= 1.0 || (sweep > 0.0 && theta < sweep * std::f32::consts::TAU);
                if on_arc { arc } else { TRACK }
            } else if dist <= DOT {
                match dot {
                    Some(color) => color,
                    None => continue,
                }
            } else {
                continue;
            };
            let i = (y * SIZE + x) * 4;
            buf[i..i + 4].copy_from_slice(&color);
        }
    }
    buf
}

pub fn install(app: &AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(PANEL) {
        bind_panel_events(&window);
    }
    if let Some(window) = app.get_webview_window(DAY) {
        bind_hide_on_close(&window);
    }

    let menu = build_menu(app, None, false)?;
    let _ = menu_label_changed(&None);
    let rgba = ring_rgba("idle", 0.0);
    TrayIconBuilder::with_id(TRAY_ID)
        .icon(Image::new(&rgba, SIZE as u32, SIZE as u32))
        .tooltip("Помодоро")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "open" => {
                let _ = open_day(app);
            }
            "quit" => request_quit(app),
            "pause" => emit_timer_action(app, "pause"),
            "resume" => emit_timer_action(app, "resume"),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                rect,
                ..
            } = event
            {
                remember_tray_rect(rect);
                let _ = toggle_panel(tray.app_handle());
            }
        })
        .build(app)
        .map_err(|err| err.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn set_tray_status(app: AppHandle, status: TrayStatus) -> Result<(), String> {
    let tray = app
        .tray_by_id(TRAY_ID)
        .ok_or_else(|| "трей не найден".to_string())?;
    let rgba = ring_rgba(&status.ring_mode, status.ring_progress);
    tray.set_icon(Some(Image::new(&rgba, SIZE as u32, SIZE as u32)))
        .map_err(|err| err.to_string())?;
    tray.set_tooltip(Some(status.tooltip.as_str()))
        .map_err(|err| err.to_string())?;

    tray.set_title(menu_bar_title(status.menu_bar_label.as_deref()))
        .map_err(|err| err.to_string())?;

    if menu_label_changed(&status.menu_pause_label) {
        let menu = build_menu(
            &app,
            status.menu_pause_label.as_deref(),
            status.paused,
        )?;
        tray.set_menu(Some(menu)).map_err(|err| err.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn show_panel(app: AppHandle) -> Result<(), String> {
    open_panel(&app)
}

#[tauri::command]
pub fn show_day(app: AppHandle) -> Result<(), String> {
    open_day(&app)
}

#[tauri::command]
pub fn hide_panel(app: AppHandle) -> Result<(), String> {
    let window = webview(&app, PANEL)?;
    hide_with_retry(&window)
}

#[tauri::command]
pub fn quit(app: AppHandle) {
    request_quit(&app);
}

pub fn open_panel(app: &AppHandle) -> Result<(), String> {
    let window = webview(app, PANEL)?;
    let _ = window.unminimize();
    place_panel(&window)?;
    if let Ok(mut shown) = PANEL_SHOWN_AT.lock() {
        *shown = Some(Instant::now());
    }
    let _ = window.set_always_on_top(true);
    window.show().map_err(|err| err.to_string())?;
    window.set_focus().map_err(|err| err.to_string())?;
    Ok(())
}

fn open_day(app: &AppHandle) -> Result<(), String> {
    if let Ok(panel) = webview(app, PANEL) {
        let _ = hide_with_retry(&panel);
    }
    let window = webview(app, DAY)?;
    let _ = window.unminimize();
    window.show().map_err(|err| err.to_string())?;
    window.set_focus().map_err(|err| err.to_string())?;
    Ok(())
}

fn toggle_panel(app: &AppHandle) -> Result<(), String> {
    let window = webview(app, PANEL)?;
    if window.is_visible().map_err(|err| err.to_string())? {
        window.hide().map_err(|err| err.to_string())?;
        Ok(())
    } else {
        open_panel(app)
    }
}

fn request_quit(app: &AppHandle) {
    crate::clock::stop();
    QUITTING.store(true, Ordering::SeqCst);
    app.exit(0);
}

fn emit_timer_action(app: &AppHandle, action: &str) {
    let _ = app.emit_to(PANEL, "timer-action", serde_json::json!({ "type": action }));
}

fn webview(app: &AppHandle, label: &str) -> Result<WebviewWindow, String> {
    app.get_webview_window(label)
        .ok_or_else(|| format!("окно {label} не найдено"))
}

fn hide_with_retry(window: &WebviewWindow) -> Result<(), String> {
    let _ = window.set_always_on_top(false);
    match window.hide() {
        Ok(()) => Ok(()),
        Err(err) => {
            eprintln!("не удалось скрыть окно, повтор: {err}");
            window.hide().map_err(|retry| retry.to_string())
        }
    }
}

fn bind_hide_on_close(window: &WebviewWindow) {
    let hidden = window.clone();
    window.on_window_event(move |event| {
        if let tauri::WindowEvent::CloseRequested { api, .. } = event {
            if QUITTING.load(Ordering::SeqCst) {
                return;
            }
            api.prevent_close();
            let _ = hide_with_retry(&hidden);
        }
    });
}

fn bind_panel_events(window: &WebviewWindow) {
    let hidden = window.clone();
    window.on_window_event(move |event| {
        match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                if QUITTING.load(Ordering::SeqCst) {
                    return;
                }
                api.prevent_close();
                let _ = hide_with_retry(&hidden);
            }
            tauri::WindowEvent::Focused(false) => {
                if QUITTING.load(Ordering::SeqCst) {
                    return;
                }
                let elapsed = PANEL_SHOWN_AT
                    .lock()
                    .ok()
                    .and_then(|shown| *shown)
                    .map(|at| at.elapsed().as_millis())
                    .unwrap_or(0);
                if should_dismiss_panel(elapsed, cursor_on_tray(&hidden)) {
                    let _ = hide_with_retry(&hidden);
                }
            }
            _ => {}
        }
    });
}

fn cursor_on_tray(window: &WebviewWindow) -> bool {
    let rect = TRAY_ANCHOR.lock().ok().and_then(|anchor| *anchor);
    let Ok(cursor) = window.cursor_position() else {
        return false;
    };
    cursor_in_tray_rect(cursor.x, cursor.y, rect)
}

fn place_panel(window: &WebviewWindow) -> Result<(), String> {
    let monitor = monitor_for_panel(window)?;
    let work = *monitor.work_area();
    let outer = window.outer_size().map_err(|err| err.to_string())?;
    let (x, y) = panel_origin(&work, monitor.scale_factor(), outer);
    window
        .set_position(PhysicalPosition::new(x, y))
        .map_err(|err| err.to_string())
}

fn monitor_for_panel(window: &WebviewWindow) -> Result<tauri::Monitor, String> {
    let monitors = window.available_monitors().map_err(|err| err.to_string())?;
    if let Ok(cursor) = window.cursor_position() {
        if let Some(found) = monitors.iter().find(|monitor| {
            let position = monitor.position();
            let size = monitor.size();
            cursor.x >= position.x as f64
                && cursor.x < position.x as f64 + size.width as f64
                && cursor.y >= position.y as f64
                && cursor.y < position.y as f64 + size.height as f64
        }) {
            return Ok(found.clone());
        }
    }
    window
        .primary_monitor()
        .map_err(|err| err.to_string())?
        .or_else(|| monitors.into_iter().next())
        .ok_or_else(|| "монитор не найден".to_string())
}

fn panel_origin(
    work: &tauri::PhysicalRect<i32, u32>,
    scale: f64,
    outer: PhysicalSize<u32>,
) -> (i32, i32) {
    let right = work.position.x + work.size.width as i32 - outer.width as i32;
    let bottom = work.position.y + work.size.height as i32 - outer.height as i32;

    #[cfg(target_os = "windows")]
    {
        let margin = (12.0 * scale).round() as i32;
        return (right, bottom - margin);
    }

    #[cfg(target_os = "macos")]
    {
        let _ = (scale, bottom);
        if let Some((ax, ay, aw, ah)) = tray_anchor() {
            if aw > 0 && ah > 0 {
                let min_x = work.position.x;
                let max_x = right.max(min_x);
                let x = (ax + aw - outer.width as i32).clamp(min_x, max_x);
                return (x, ay + ah);
            }
        }
        return (right, work.position.y);
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let _ = scale;
        (right, bottom)
    }
}

fn remember_tray_rect(rect: tauri::Rect) {
    let position = rect.position.to_physical::<i32>(1.0);
    let size = rect.size.to_physical::<u32>(1.0);
    if let Ok(mut anchor) = TRAY_ANCHOR.lock() {
        *anchor = Some((
            position.x,
            position.y,
            size.width as i32,
            size.height as i32,
        ));
    }
}

#[cfg(target_os = "macos")]
fn tray_anchor() -> Option<(i32, i32, i32, i32)> {
    TRAY_ANCHOR.lock().ok().and_then(|anchor| *anchor)
}

fn menu_bar_title(label: Option<&str>) -> Option<&str> {
    #[cfg(target_os = "macos")]
    {
        return label.filter(|value| !value.is_empty());
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = label;
        None
    }
}

fn menu_label_changed(next: &Option<String>) -> bool {
    let Ok(mut current) = MENU_LABEL.lock() else {
        return true;
    };
    if current.as_ref() == Some(next) {
        return false;
    }
    *current = Some(next.clone());
    true
}

fn build_menu(
    app: &AppHandle,
    pause_label: Option<&str>,
    paused: bool,
) -> Result<Menu<tauri::Wry>, String> {
    let open = MenuItem::with_id(app, "open", "Открыть", true, None::<&str>)
        .map_err(|err| err.to_string())?;
    let quit = MenuItem::with_id(app, "quit", "Выйти", true, None::<&str>)
        .map_err(|err| err.to_string())?;
    let menu = if let Some(label) = pause_label {
        let id = if paused { "resume" } else { "pause" };
        let pause =
            MenuItem::with_id(app, id, label, true, None::<&str>).map_err(|err| err.to_string())?;
        Menu::with_items(app, &[&pause, &open, &quit])
    } else {
        Menu::with_items(app, &[&open, &quit])
    };
    menu.map_err(|err| err.to_string())
}

#[cfg(test)]
mod tests {
    use super::{cursor_in_tray_rect, ring_rgba, should_dismiss_panel};

    const SIZE: usize = 32;

    fn pixel(buf: &[u8; SIZE * SIZE * 4], x: usize, y: usize) -> [u8; 4] {
        let i = (y * SIZE + x) * 4;
        [buf[i], buf[i + 1], buf[i + 2], buf[i + 3]]
    }

    #[test]
    fn ring_rgba_buffer_is_32_square() {
        let buf = ring_rgba("focus", 1.0);
        assert_eq!(buf.len(), SIZE * SIZE * 4);
    }

    #[test]
    fn ring_rgba_focus_full_and_empty_differ_at_top_of_circle() {
        let full = ring_rgba("focus", 1.0);
        let empty = ring_rgba("focus", 0.0);
        // Центр пикселя (15, 3) — (15.5, 3.5), ровно на 12 px выше центра (15.5, 15.5).
        assert_ne!(
            pixel(&full, 15, 3),
            pixel(&empty, 15, 3),
            "верхняя точка окружности должна отличаться при полном и пустом кольце"
        );
    }

    #[test]
    fn dismisses_panel_only_after_the_open_click_and_away_from_the_tray() {
        assert!(!should_dismiss_panel(299, false));
        assert!(should_dismiss_panel(300, false));
        assert!(!should_dismiss_panel(300, true));
    }

    #[test]
    fn cursor_on_tray_uses_the_icon_rectangle() {
        let rect = Some((10, 20, 32, 32));
        assert!(cursor_in_tray_rect(10.0, 20.0, rect));
        assert!(!cursor_in_tray_rect(42.0, 20.0, rect));
        assert!(!cursor_in_tray_rect(10.0, 20.0, None));
        assert!(!cursor_in_tray_rect(10.0, 20.0, Some((10, 20, 0, 32))));
    }

    #[test]
    fn ring_rgba_overtime_center_differs_from_focus() {
        let overtime = ring_rgba("overtime", 1.0);
        let focus = ring_rgba("focus", 1.0);
        assert_ne!(
            pixel(&overtime, 15, 15),
            pixel(&focus, 15, 15),
            "центр добавочного времени должен читаться иначе, чем центр фокуса"
        );
    }
}

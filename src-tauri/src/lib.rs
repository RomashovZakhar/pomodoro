// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod clock;
mod tray;

use std::path::Path;
use tauri::Manager;

const POMODORO_FILE: &str = "pomodoro.json";
const POMODORO_TEMP_FILE: &str = "pomodoro.json.tmp";

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

fn atomic_replace(from: &Path, to: &Path) -> std::io::Result<()> {
    #[cfg(windows)]
    {
        use std::os::windows::ffi::OsStrExt;

        #[link(name = "kernel32")]
        unsafe extern "system" {
            fn MoveFileExW(
                lpExistingFileName: *const u16,
                lpNewFileName: *const u16,
                dwFlags: u32,
            ) -> i32;
        }

        const MOVEFILE_REPLACE_EXISTING: u32 = 0x00000001;
        const MOVEFILE_WRITE_THROUGH: u32 = 0x00000008;

        fn wide(path: &Path) -> Vec<u16> {
            path.as_os_str()
                .encode_wide()
                .chain(std::iter::once(0))
                .collect()
        }

        let ok = unsafe {
            MoveFileExW(
                wide(from).as_ptr(),
                wide(to).as_ptr(),
                MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
            )
        };
        if ok == 0 {
            return Err(std::io::Error::last_os_error());
        }
        Ok(())
    }

    #[cfg(not(windows))]
    {
        std::fs::rename(from, to)
    }
}

#[tauri::command]
fn read_alert_sound(app: tauri::AppHandle, name: String) -> Result<Vec<u8>, String> {
    if name != "focus-end" && name != "break-end" {
        return Err("неизвестный сигнал".into());
    }
    let path = app
        .path()
        .resolve(
            format!("sounds/{name}.wav"),
            tauri::path::BaseDirectory::Resource,
        )
        .map_err(|err| err.to_string())?;
    std::fs::read(path).map_err(|err| err.to_string())
}

#[tauri::command]
fn replace_storage_file(app: tauri::AppHandle) -> Result<(), String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let from = dir.join(POMODORO_TEMP_FILE);
    let to = dir.join(POMODORO_FILE);
    atomic_replace(&from, &to).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            let app = app.clone();
            let _ = app.clone().run_on_main_thread(move || {
                let _ = tray::open_panel(&app);
            });
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .setup(|app| {
            tray::install(app.handle()).map_err(|err| -> Box<dyn std::error::Error> {
                std::io::Error::other(err).into()
            })?;
            clock::start(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            replace_storage_file,
            read_alert_sound,
            tray::set_tray_status,
            tray::show_panel,
            tray::show_day,
            tray::quit
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

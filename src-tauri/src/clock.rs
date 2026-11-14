use std::sync::{Condvar, Mutex};
use std::thread;
use std::time::Duration;

use tauri::{AppHandle, Emitter};

static STOP: Mutex<bool> = Mutex::new(false);
static WAKE: Condvar = Condvar::new();

/// Wakes the hidden panel once a second. The webview applies `{ type: "tick" }`
/// with the wall clock; this thread does not own the session.
pub fn start(app: AppHandle) {
    thread::spawn(move || {
        loop {
            let guard = STOP.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
            if *guard {
                break;
            }
            let (guard, _) = WAKE
                .wait_timeout(guard, Duration::from_secs(1))
                .unwrap_or_else(|poisoned| poisoned.into_inner());
            if *guard {
                break;
            }
            drop(guard);
            let _ = app.emit_to("panel", "timer-tick", serde_json::Value::Null);
        }
    });
}

pub fn stop() {
    let mut guard = STOP.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    *guard = true;
    drop(guard);
    WAKE.notify_all();
}

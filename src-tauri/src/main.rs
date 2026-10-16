// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    std::panic::set_hook(Box::new(|panic_info| {
        let msg = format!("Panic: {:?}\nBacktrace: {:?}", panic_info, std::backtrace::Backtrace::capture());
        let _ = std::fs::write("panic.log", msg);
    }));
    localban_lib::run();
}

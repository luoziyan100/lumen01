use tauri::Manager;

mod db;
mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            let db_state = db::init_db(app.handle())
                .expect("数据库初始化失败");
            app.manage(db_state);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::papers::add_paper,
            commands::papers::list_papers,
            commands::papers::get_paper,
            commands::papers::delete_paper,
            commands::files::import_pdf,
            commands::files::read_pdf_file,
            commands::ai_config::save_ai_config,
            commands::ai_config::get_ai_config,
            commands::collections::create_collection,
            commands::collections::list_collections,
            commands::collections::update_collection,
            commands::collections::delete_collection,
            commands::collections::add_paper_to_collection,
            commands::collections::remove_paper_from_collection,
            commands::collections::list_collection_papers,
            commands::annotations::create_annotation,
            commands::annotations::list_annotations,
            commands::annotations::delete_annotation,
            commands::research::create_research_project,
            commands::research::list_research_projects,
            commands::research::get_research_project,
            commands::research::update_research_project,
            commands::research::delete_research_project,
            commands::research::add_paper_to_research,
            commands::research::remove_paper_from_research,
            commands::research::list_research_papers,
            commands::research::save_research_report,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

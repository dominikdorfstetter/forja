//! Dashboard static file serving
//!
//! Serves the built Preact dashboard from /dashboard

use rocket::fs::NamedFile;
use rocket::response::content::RawHtml;
use rocket::Route;
use std::path::{Path, PathBuf};

/// Serve dashboard index.html
#[get("/")]
pub async fn dashboard_index() -> Option<RawHtml<String>> {
    let path = Path::new("static/dashboard/index.html");
    if path.exists() {
        std::fs::read_to_string(path).ok().map(RawHtml)
    } else {
        Some(RawHtml(dashboard_not_built_html()))
    }
}

/// Serve dashboard static files
#[get("/<file..>")]
pub async fn dashboard_files(file: PathBuf) -> Option<NamedFile> {
    let path = Path::new("static/dashboard").join(&file);

    if path.exists() && path.is_file() {
        NamedFile::open(path).await.ok()
    } else {
        // For SPA routing, serve index.html for non-file paths
        let index_path = Path::new("static/dashboard/index.html");
        if index_path.exists() {
            NamedFile::open(index_path).await.ok()
        } else {
            None
        }
    }
}

/// Fallback HTML when dashboard is not built
fn dashboard_not_built_html() -> String {
    r#"<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard Not Built</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #1a237e 0%, #0d47a1 50%, #01579b 100%);
            color: white;
        }
        .container {
            text-align: center;
            padding: 2rem;
            max-width: 600px;
        }
        h1 { font-size: 2rem; margin-bottom: 1rem; }
        p { opacity: 0.9; line-height: 1.6; }
        code {
            display: block;
            background: rgba(255,255,255,0.1);
            padding: 1rem;
            border-radius: 8px;
            margin: 1rem 0;
            font-family: monospace;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Dashboard Not Built</h1>
        <p>The dashboard has not been built yet. Run the following commands to build it:</p>
        <code>
            cd admin<br>
            npm install<br>
            npm run build
        </code>
        <p>The built files will be placed in <strong>backend/static/dashboard</strong></p>
    </div>
</body>
</html>"#
        .to_string()
}

/// Collect dashboard routes
pub fn routes() -> Vec<Route> {
    routes![dashboard_index, dashboard_files]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_fallback_html_not_empty() {
        let html = dashboard_not_built_html();
        assert!(!html.is_empty());
        assert!(html.contains("Dashboard Not Built"));
    }
}

//! Mobile Dashboard
//!
//! Serves a responsive PWA dashboard at `/dashboard` for mobile clients.
//! All assets are embedded in the binary via `include_str!()`.

use axum::{
    extract::Query,
    http::{header, StatusCode},
    response::{Html, IntoResponse, Response},
    routing::get,
    Router,
};
use serde::Deserialize;

#[derive(Deserialize)]
pub struct DashboardQuery {
    #[serde(default)]
    token: Option<String>,
}

/// Create the dashboard router. Mount via `nest("/dashboard", ...)`.
pub fn create_dashboard_router() -> Router {
    Router::new()
        .route("/", get(handle_dashboard))
        .route("/app.js", get(handle_js))
        .route("/style.css", get(handle_css))
        .route("/manifest.json", get(handle_manifest))
        .route("/icon-192.png", get(handle_icon_192))
        .route("/icon-512.png", get(handle_icon_512))
}

async fn handle_dashboard(Query(q): Query<DashboardQuery>) -> Html<String> {
    let html = include_str!("../static/index.html");
    // Inject token into HTML if provided via query param
    let html = if let Some(token) = q.token {
        html.replace("%%INJECT_TOKEN%%", &token)
    } else {
        html.replace("%%INJECT_TOKEN%%", "")
    };
    Html(html)
}

async fn handle_js() -> Response {
    (
        StatusCode::OK,
        [(header::CONTENT_TYPE, "application/javascript; charset=utf-8")],
        include_str!("../static/app.js"),
    )
        .into_response()
}

async fn handle_css() -> Response {
    (
        StatusCode::OK,
        [(header::CONTENT_TYPE, "text/css; charset=utf-8")],
        include_str!("../static/style.css"),
    )
        .into_response()
}

async fn handle_manifest() -> Response {
    (
        StatusCode::OK,
        [(header::CONTENT_TYPE, "application/manifest+json")],
        include_str!("../static/manifest.json"),
    )
        .into_response()
}

async fn handle_icon_192() -> Response {
    (
        StatusCode::OK,
        [
            (header::CONTENT_TYPE, "image/png"),
            (header::CACHE_CONTROL, "public, max-age=86400"),
        ],
        include_bytes!("../icons/128x128@2x.png").as_slice(),
    )
        .into_response()
}

async fn handle_icon_512() -> Response {
    (
        StatusCode::OK,
        [
            (header::CONTENT_TYPE, "image/png"),
            (header::CACHE_CONTROL, "public, max-age=86400"),
        ],
        include_bytes!("../icons/icon.png").as_slice(),
    )
        .into_response()
}

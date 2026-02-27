//! Database configuration

use serde::Deserialize;

/// Database connection configuration
#[derive(Debug, Clone, Deserialize)]
pub struct DatabaseConfig {
    /// PostgreSQL connection URL
    pub url: String,

    /// Maximum number of connections in the pool
    #[serde(default = "default_max_connections")]
    pub max_connections: u32,

    /// Minimum number of connections in the pool
    #[serde(default = "default_min_connections")]
    pub min_connections: u32,

    /// Connection timeout in seconds
    #[serde(default = "default_connect_timeout")]
    pub connect_timeout_seconds: u64,

    /// Idle timeout in seconds
    #[serde(default = "default_idle_timeout")]
    pub idle_timeout_seconds: u64,
}

fn default_max_connections() -> u32 {
    10
}

fn default_min_connections() -> u32 {
    1
}

fn default_connect_timeout() -> u64 {
    30
}

fn default_idle_timeout() -> u64 {
    600
}

impl Default for DatabaseConfig {
    fn default() -> Self {
        Self {
            url: String::from("postgres://postgres:postgres@localhost:5432/openyapper"),
            max_connections: default_max_connections(),
            min_connections: default_min_connections(),
            connect_timeout_seconds: default_connect_timeout(),
            idle_timeout_seconds: default_idle_timeout(),
        }
    }
}

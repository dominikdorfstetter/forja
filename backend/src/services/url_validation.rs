//! SSRF-safe URL validation.
//!
//! Provides IP and URL validation that rejects requests targeting private or
//! internal IP ranges, preventing server-side request forgery (SSRF) attacks.
//!
//! Used by webhook delivery and other outbound HTTP requests.

use std::net::IpAddr;

use crate::errors::ApiError;

/// Check whether an IP address is publicly routable.
///
/// Rejects: loopback, private (RFC 1918), link-local, broadcast,
/// unspecified, documentation ranges, CGNAT (100.64.0.0/10),
/// IPv6 ULA (fc00::/7), and IPv6 link-local (fe80::/10).
pub fn is_public_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => {
            !v4.is_loopback()              // 127.0.0.0/8
                && !v4.is_private()        // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
                && !v4.is_link_local()     // 169.254.0.0/16
                && !v4.is_broadcast()      // 255.255.255.255
                && !v4.is_unspecified()    // 0.0.0.0
                && !v4.is_documentation()  // 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24
                && !is_shared_address(v4) // 100.64.0.0/10 (CGNAT)
        }
        IpAddr::V6(v6) => {
            !v6.is_loopback()              // ::1
                && !v6.is_unspecified()    // ::
                && !is_ipv6_ula(&v6)       // fc00::/7
                && !is_ipv6_link_local(&v6) // fe80::/10
                && !is_ipv4_mapped_private(&v6)
        }
    }
}

/// Check if an IPv4 address is in the Shared Address Space (100.64.0.0/10, CGNAT).
fn is_shared_address(ip: std::net::Ipv4Addr) -> bool {
    let octets = ip.octets();
    octets[0] == 100 && (octets[1] & 0xC0) == 64
}

/// Check if an IPv6 address is a Unique Local Address (fc00::/7).
fn is_ipv6_ula(ip: &std::net::Ipv6Addr) -> bool {
    let segments = ip.segments();
    (segments[0] & 0xFE00) == 0xFC00
}

/// Check if an IPv6 address is link-local (fe80::/10).
fn is_ipv6_link_local(ip: &std::net::Ipv6Addr) -> bool {
    let segments = ip.segments();
    (segments[0] & 0xFFC0) == 0xFE80
}

/// Check if an IPv6 address is an IPv4-mapped address (::ffff:x.x.x.x) with a private IPv4.
fn is_ipv4_mapped_private(ip: &std::net::Ipv6Addr) -> bool {
    if let Some(v4) = ip.to_ipv4_mapped() {
        !is_public_ip(IpAddr::V4(v4))
    } else {
        false
    }
}

/// Validate a target URL and resolve it to a single pinned public `SocketAddr`.
///
/// Returns `(host, socket_addr)` where `host` is the URL's hostname and
/// `socket_addr` is the first DNS-resolved address that passes the public-IP
/// check. All resolved addresses must be public — if any resolve to a private
/// range, the whole URL is rejected so we don't open a race window.
///
/// Callers should pass the returned `socket_addr` to
/// [`reqwest::ClientBuilder::resolve`] so the HTTP client cannot re-query DNS
/// and end up connecting to a different (private) address — this is the fix
/// for the classic DNS rebinding TOCTOU in SSRF protection.
pub async fn validate_and_resolve_url(
    url: &str,
) -> Result<(String, std::net::SocketAddr), ApiError> {
    let parsed =
        url::Url::parse(url).map_err(|e| ApiError::bad_request(format!("Invalid URL: {e}")))?;

    let scheme = parsed.scheme();
    if scheme != "https" && scheme != "http" {
        return Err(ApiError::bad_request(format!(
            "Unsupported URL scheme: {scheme}"
        )));
    }

    let host = parsed
        .host_str()
        .ok_or_else(|| ApiError::bad_request("URL has no host"))?
        .to_string();

    let port = parsed.port_or_known_default().unwrap_or(443);
    let lookup_target = format!("{}:{}", host, port);

    let resolved: Vec<std::net::SocketAddr> = tokio::net::lookup_host(&lookup_target)
        .await
        .map_err(|e| ApiError::bad_request(format!("DNS resolution failed for {host}: {e}")))?
        .collect();

    if resolved.is_empty() {
        return Err(ApiError::bad_request(format!(
            "No DNS records found for {host}"
        )));
    }

    // Every resolved IP must be public — if any is private, reject the whole
    // URL. Otherwise a low-TTL DNS record could still expose internal services
    // to a later request if reqwest picks a different address.
    for socket_addr in &resolved {
        if !is_public_ip(socket_addr.ip()) {
            return Err(ApiError::forbidden(format!(
                "Target resolves to non-public IP: {}",
                socket_addr.ip()
            )));
        }
    }

    // All addresses are public — take the first one as the pinned target.
    let pinned = resolved[0];
    Ok((host, pinned))
}

/// Validate that a target URL resolves only to public IP addresses.
///
/// Thin wrapper over [`validate_and_resolve_url`] for callers that only need
/// to reject unsafe URLs and don't consume the resolved `SocketAddr`.
pub async fn validate_target_url(url: &str) -> Result<(), ApiError> {
    validate_and_resolve_url(url).await.map(|_| ())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::{Ipv4Addr, Ipv6Addr};

    // --- is_public_ip: IPv4 rejections ---

    #[test]
    fn rejects_loopback() {
        assert!(!is_public_ip(IpAddr::V4(Ipv4Addr::LOCALHOST)));
        assert!(!is_public_ip(IpAddr::V4(Ipv4Addr::new(127, 0, 0, 2))));
    }

    #[test]
    fn rejects_private_ranges() {
        assert!(!is_public_ip(IpAddr::V4(Ipv4Addr::new(10, 0, 0, 1))));
        assert!(!is_public_ip(IpAddr::V4(Ipv4Addr::new(10, 255, 255, 255))));
        assert!(!is_public_ip(IpAddr::V4(Ipv4Addr::new(172, 16, 0, 1))));
        assert!(!is_public_ip(IpAddr::V4(Ipv4Addr::new(172, 31, 255, 255))));
        assert!(!is_public_ip(IpAddr::V4(Ipv4Addr::new(192, 168, 1, 1))));
        assert!(!is_public_ip(IpAddr::V4(Ipv4Addr::new(192, 168, 255, 255))));
    }

    #[test]
    fn rejects_link_local() {
        assert!(!is_public_ip(IpAddr::V4(Ipv4Addr::new(169, 254, 1, 1))));
    }

    #[test]
    fn rejects_broadcast() {
        assert!(!is_public_ip(IpAddr::V4(Ipv4Addr::BROADCAST)));
    }

    #[test]
    fn rejects_unspecified() {
        assert!(!is_public_ip(IpAddr::V4(Ipv4Addr::UNSPECIFIED)));
    }

    #[test]
    fn rejects_cgnat() {
        assert!(!is_public_ip(IpAddr::V4(Ipv4Addr::new(100, 64, 0, 1))));
        assert!(!is_public_ip(IpAddr::V4(Ipv4Addr::new(100, 127, 255, 255))));
    }

    #[test]
    fn rejects_documentation_ranges() {
        assert!(!is_public_ip(IpAddr::V4(Ipv4Addr::new(192, 0, 2, 1))));
        assert!(!is_public_ip(IpAddr::V4(Ipv4Addr::new(198, 51, 100, 1))));
        assert!(!is_public_ip(IpAddr::V4(Ipv4Addr::new(203, 0, 113, 1))));
    }

    // --- is_public_ip: IPv6 rejections ---

    #[test]
    fn rejects_ipv6_loopback() {
        assert!(!is_public_ip(IpAddr::V6(Ipv6Addr::LOCALHOST)));
    }

    #[test]
    fn rejects_ipv6_ula() {
        let ula = Ipv6Addr::new(0xfc00, 0, 0, 0, 0, 0, 0, 1);
        assert!(!is_public_ip(IpAddr::V6(ula)));
        let ula2 = Ipv6Addr::new(0xfd12, 0x3456, 0, 0, 0, 0, 0, 1);
        assert!(!is_public_ip(IpAddr::V6(ula2)));
    }

    #[test]
    fn rejects_ipv6_link_local() {
        let ll = Ipv6Addr::new(0xfe80, 0, 0, 0, 0, 0, 0, 1);
        assert!(!is_public_ip(IpAddr::V6(ll)));
    }

    #[test]
    fn rejects_ipv4_mapped_private() {
        let mapped = Ipv6Addr::new(0, 0, 0, 0, 0, 0xffff, 0x7f00, 0x0001);
        assert!(!is_public_ip(IpAddr::V6(mapped)));
        let mapped_private = Ipv6Addr::new(0, 0, 0, 0, 0, 0xffff, 0xc0a8, 0x0101);
        assert!(!is_public_ip(IpAddr::V6(mapped_private)));
    }

    // --- is_public_ip: accepts public ---

    #[test]
    fn accepts_public_ips() {
        assert!(is_public_ip(IpAddr::V4(Ipv4Addr::new(8, 8, 8, 8))));
        assert!(is_public_ip(IpAddr::V4(Ipv4Addr::new(1, 1, 1, 1))));
        assert!(is_public_ip(IpAddr::V4(Ipv4Addr::new(93, 184, 216, 34))));
        let public_v6 = Ipv6Addr::new(0x2001, 0x4860, 0x4860, 0, 0, 0, 0, 0x8888);
        assert!(is_public_ip(IpAddr::V6(public_v6)));
    }

    // --- validate_target_url: sync validation (no DNS) ---

    #[tokio::test]
    async fn rejects_non_http_scheme() {
        let result = validate_target_url("ftp://example.com/hook").await;
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(err.to_string().contains("Unsupported URL scheme"));
    }

    #[tokio::test]
    async fn rejects_invalid_url() {
        let result = validate_target_url("not-a-url").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn rejects_url_without_host() {
        let result = validate_target_url("http://").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn accepts_valid_public_https_url() {
        // This test does real DNS resolution — skip in CI if no network
        let result = validate_target_url("https://example.com/webhook").await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn rejects_localhost_url() {
        let result = validate_target_url("http://localhost:8000/health").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn rejects_loopback_ip_url() {
        let result = validate_target_url("http://127.0.0.1:8000/health").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn rejects_private_ip_url() {
        let result = validate_target_url("http://192.168.1.1:8080/hook").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn rejects_metadata_endpoint() {
        let result = validate_target_url("http://169.254.169.254/latest/meta-data").await;
        assert!(result.is_err());
    }

    // --- validate_and_resolve_url: returns pinned SocketAddr ---

    #[tokio::test]
    async fn resolve_returns_host_and_public_socket_addr() {
        let (host, addr) = validate_and_resolve_url("https://example.com/webhook")
            .await
            .expect("example.com should resolve to a public IP");
        assert_eq!(host, "example.com");
        assert!(is_public_ip(addr.ip()), "resolved IP must be public");
    }

    #[tokio::test]
    async fn resolve_rejects_loopback_url() {
        let result = validate_and_resolve_url("http://127.0.0.1:8000/health").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn resolve_rejects_private_ip_url() {
        let result = validate_and_resolve_url("http://192.168.1.1:8080/hook").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn resolve_rejects_metadata_endpoint_url() {
        let result = validate_and_resolve_url("http://169.254.169.254/latest/meta-data").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn resolve_rejects_non_http_scheme() {
        let result = validate_and_resolve_url("ftp://example.com/webhook").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn resolve_rejects_invalid_url() {
        let result = validate_and_resolve_url("not-a-url").await;
        assert!(result.is_err());
    }
}

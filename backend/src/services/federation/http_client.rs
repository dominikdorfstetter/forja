//! SSRF-safe HTTP client for ActivityPub federation.
//!
//! Provides a pre-configured `reqwest::Client` and URL validation that
//! rejects requests to private/internal IP ranges, preventing server-side
//! request forgery attacks.

use std::net::IpAddr;

use crate::errors::ApiError;

/// Check whether an IP address is publicly routable.
///
/// Rejects: loopback, private (RFC 1918), link-local, broadcast,
/// unspecified, IPv6 ULA (fc00::/7), and IPv6 link-local (fe80::/10).
pub fn is_public_ip(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => {
            !v4.is_loopback()              // 127.0.0.0/8
                && !v4.is_private()        // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
                && !v4.is_link_local()     // 169.254.0.0/16
                && !v4.is_broadcast()      // 255.255.255.255
                && !v4.is_unspecified()    // 0.0.0.0
                && !v4.is_documentation() // 192.0.2.0/24, 198.51.100.0/24, 203.0.113.0/24
                && !is_shared_address(v4) // 100.64.0.0/10 (CGNAT)
        }
        IpAddr::V6(v6) => {
            !v6.is_loopback()          // ::1
                && !v6.is_unspecified() // ::
                && !is_ipv6_ula(&v6)    // fc00::/7
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

/// Create a pre-configured reqwest HTTP client for federation requests.
///
/// - 10 second timeout
/// - Max 3 redirects
/// - User-Agent: "Forja/1.0 (ActivityPub)"
pub fn federation_http_client() -> Result<reqwest::Client, ApiError> {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .redirect(reqwest::redirect::Policy::limited(3))
        .user_agent("Forja/1.0 (ActivityPub)")
        .build()
        .map_err(|e| ApiError::internal(format!("Failed to build HTTP client: {e}")))
}

/// Validate that a target URL resolves only to public IP addresses.
///
/// Parses the URL, performs DNS resolution, and checks that every resolved
/// IP is publicly routable. Rejects URLs that would hit internal services.
pub async fn validate_target_url(url: &str) -> Result<(), ApiError> {
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
        .ok_or_else(|| ApiError::bad_request("URL has no host"))?;

    let port = parsed.port_or_known_default().unwrap_or(443);
    let addr = format!("{}:{}", host, port);

    let resolved: Vec<std::net::SocketAddr> = tokio::net::lookup_host(&addr)
        .await
        .map_err(|e| ApiError::bad_request(format!("DNS resolution failed for {host}: {e}")))?
        .collect();

    if resolved.is_empty() {
        return Err(ApiError::bad_request(format!(
            "No DNS records found for {host}"
        )));
    }

    for socket_addr in &resolved {
        if !is_public_ip(socket_addr.ip()) {
            return Err(ApiError::forbidden(format!(
                "Target resolves to non-public IP: {}",
                socket_addr.ip()
            )));
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::net::{Ipv4Addr, Ipv6Addr};

    // --- is_public_ip: IPv4 rejections ---

    #[test]
    fn test_rejects_loopback() {
        assert!(!is_public_ip(IpAddr::V4(Ipv4Addr::LOCALHOST)));
        assert!(!is_public_ip(IpAddr::V4(Ipv4Addr::new(127, 0, 0, 2))));
    }

    #[test]
    fn test_rejects_private_ranges() {
        // 10.0.0.0/8
        assert!(!is_public_ip(IpAddr::V4(Ipv4Addr::new(10, 0, 0, 1))));
        assert!(!is_public_ip(IpAddr::V4(Ipv4Addr::new(10, 255, 255, 255))));
        // 172.16.0.0/12
        assert!(!is_public_ip(IpAddr::V4(Ipv4Addr::new(172, 16, 0, 1))));
        assert!(!is_public_ip(IpAddr::V4(Ipv4Addr::new(172, 31, 255, 255))));
        // 192.168.0.0/16
        assert!(!is_public_ip(IpAddr::V4(Ipv4Addr::new(192, 168, 1, 1))));
        assert!(!is_public_ip(IpAddr::V4(Ipv4Addr::new(192, 168, 255, 255))));
    }

    #[test]
    fn test_rejects_link_local() {
        assert!(!is_public_ip(IpAddr::V4(Ipv4Addr::new(169, 254, 1, 1))));
    }

    #[test]
    fn test_rejects_broadcast() {
        assert!(!is_public_ip(IpAddr::V4(Ipv4Addr::BROADCAST)));
    }

    #[test]
    fn test_rejects_unspecified() {
        assert!(!is_public_ip(IpAddr::V4(Ipv4Addr::UNSPECIFIED)));
    }

    // --- is_public_ip: IPv6 rejections ---

    #[test]
    fn test_rejects_ipv6_loopback() {
        assert!(!is_public_ip(IpAddr::V6(Ipv6Addr::LOCALHOST)));
    }

    #[test]
    fn test_rejects_ipv6_ula() {
        // fc00::/7 — covers fc00:: through fdff::
        let ula = Ipv6Addr::new(0xfc00, 0, 0, 0, 0, 0, 0, 1);
        assert!(!is_public_ip(IpAddr::V6(ula)));
        let ula2 = Ipv6Addr::new(0xfd12, 0x3456, 0, 0, 0, 0, 0, 1);
        assert!(!is_public_ip(IpAddr::V6(ula2)));
    }

    #[test]
    fn test_rejects_ipv6_link_local() {
        let ll = Ipv6Addr::new(0xfe80, 0, 0, 0, 0, 0, 0, 1);
        assert!(!is_public_ip(IpAddr::V6(ll)));
    }

    #[test]
    fn test_rejects_ipv4_mapped_private() {
        // ::ffff:127.0.0.1
        let mapped = Ipv6Addr::new(0, 0, 0, 0, 0, 0xffff, 0x7f00, 0x0001);
        assert!(!is_public_ip(IpAddr::V6(mapped)));
        // ::ffff:192.168.1.1
        let mapped_private = Ipv6Addr::new(0, 0, 0, 0, 0, 0xffff, 0xc0a8, 0x0101);
        assert!(!is_public_ip(IpAddr::V6(mapped_private)));
    }

    // --- is_public_ip: accepts public ---

    #[test]
    fn test_accepts_public_ips() {
        assert!(is_public_ip(IpAddr::V4(Ipv4Addr::new(8, 8, 8, 8))));
        assert!(is_public_ip(IpAddr::V4(Ipv4Addr::new(1, 1, 1, 1))));
        assert!(is_public_ip(IpAddr::V4(Ipv4Addr::new(93, 184, 216, 34))));
        // Public IPv6
        let public_v6 = Ipv6Addr::new(0x2001, 0x4860, 0x4860, 0, 0, 0, 0, 0x8888);
        assert!(is_public_ip(IpAddr::V6(public_v6)));
    }

    #[test]
    fn test_rejects_cgnat() {
        assert!(!is_public_ip(IpAddr::V4(Ipv4Addr::new(100, 64, 0, 1))));
        assert!(!is_public_ip(IpAddr::V4(Ipv4Addr::new(100, 127, 255, 255))));
    }

    // --- federation_http_client ---

    #[test]
    fn test_federation_client_builds() {
        let client = federation_http_client();
        assert!(client.is_ok());
    }
}

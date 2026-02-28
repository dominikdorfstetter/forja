---
sidebar_position: 4
---

# TLS / HTTPS Configuration

OpenYapper supports native TLS termination using Rocket's built-in `rustls` integration. This allows the application to serve HTTPS directly without a reverse proxy.

## When to Use Application-Level TLS

In most deployments, TLS is handled by the infrastructure layer:

- **Railway** -- terminates TLS at the edge automatically. No application configuration needed.
- **Reverse proxy (nginx, Caddy, Traefik)** -- terminates TLS before traffic reaches the application.
- **Load balancers (AWS ALB, Cloudflare)** -- terminate TLS upstream.

You only need application-level TLS when the OpenYapper binary is directly exposed to the internet without any proxy or platform handling HTTPS for you.

## Configuration

Set two environment variables pointing to your certificate and private key files:

| Variable | Description |
|----------|-------------|
| `TLS_CERT_PATH` | Absolute path to the TLS certificate file (PEM format) |
| `TLS_KEY_PATH` | Absolute path to the TLS private key file (PEM format) |

```bash
export TLS_CERT_PATH=/etc/ssl/certs/openyapper.pem
export TLS_KEY_PATH=/etc/ssl/private/openyapper-key.pem
```

When both variables are set, the application starts with HTTPS enabled. When either variable is absent, the application starts in plain HTTP mode.

## Supported Certificate Types

Any PEM-encoded X.509 certificate chain works with OpenYapper's TLS configuration.

### Let's Encrypt (Certbot)

Use [Certbot](https://certbot.eff.org/) to obtain free certificates from Let's Encrypt:

```bash
certbot certonly --standalone -d cms.yourdomain.com
```

Then set the paths:

```bash
TLS_CERT_PATH=/etc/letsencrypt/live/cms.yourdomain.com/fullchain.pem
TLS_KEY_PATH=/etc/letsencrypt/live/cms.yourdomain.com/privkey.pem
```

:::tip
Let's Encrypt certificates expire every 90 days. Set up a cron job or systemd timer to run `certbot renew` and restart the application.
:::

### Self-Signed Certificates

For development or internal deployments, generate a self-signed certificate:

```bash
openssl req -x509 -newkey rsa:4096 \
  -keyout key.pem -out cert.pem \
  -days 365 -nodes \
  -subj "/CN=localhost"
```

```bash
TLS_CERT_PATH=./cert.pem
TLS_KEY_PATH=./key.pem
```

Clients connecting to a self-signed certificate will see a browser warning unless the certificate is explicitly trusted.

### Purchased / CA-Signed Certificates

If you have a certificate from a commercial Certificate Authority, ensure the file includes the full chain (your certificate followed by any intermediate certificates):

```bash
cat your-domain.crt intermediate.crt > fullchain.pem
```

```bash
TLS_CERT_PATH=/path/to/fullchain.pem
TLS_KEY_PATH=/path/to/your-domain.key
```

## Docker Deployments

When using Docker, mount the certificate files into the container:

```yaml
services:
  app:
    image: openyapper
    ports:
      - "443:8000"
    environment:
      TLS_CERT_PATH: /certs/fullchain.pem
      TLS_KEY_PATH: /certs/privkey.pem
    volumes:
      - /etc/letsencrypt/live/cms.yourdomain.com:/certs:ro
```

## Verifying TLS

After starting the application with TLS enabled, verify the connection:

```bash
curl -v https://localhost:8000/health
```

The output should show a successful TLS handshake and a JSON health response.

## Railway and Platform Deployments

Railway handles TLS termination at the edge automatically. All traffic between Railway's edge and your application container travels over an internal network. Do **not** set `TLS_CERT_PATH` or `TLS_KEY_PATH` on Railway -- doing so would cause the application to expect HTTPS connections from Railway's internal routing, which sends plain HTTP.

# Isolated deployment

Production serves the static application from:

```text
/var/www/pmaxus.net/projects/thesis-arena/
```

The existing pmaxus.net server block receives one include line for
`/etc/nginx/snippets/thesis-arena.conf`. The snippet:

- applies separate HTTP Basic Auth to the project;
- proxies isolated analyze, status, and saved-execution retry endpoints to n8n;
- injects the webhook header on the server, never in browser code;
- permits one active analysis per IP and rate-limits starts to one per minute;
- acknowledges a new run immediately, then allows frequent lightweight status polls.

The rate-limit zones are isolated in
`/etc/nginx/conf.d/thesis-arena-limits.conf`. Always run `nginx -t` before a
reload and keep a timestamped backup of the original pmaxus.net vhost.

The preview password file is owned by `root:www-data` with mode `0640`, so the
nginx worker can validate credentials without exposing the file publicly.

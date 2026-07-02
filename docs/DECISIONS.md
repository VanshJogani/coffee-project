# Architecture & Design Decisions

## Decision Log

### 1. Database & Hosting Strategy
**Date:** 2026-06-14  
**Status:** ✅ Decided  

**Decision:** DigitalOcean VPS (Bangalore region) + SQLite + Nginx reverse proxy + PM2/systemd

**Rationale:**
- App is read-heavy coffee catalog (~few hundred products, <10MB data)
- SQLite gives <5ms query times with zero network hop to DB
- DigitalOcean has a Bangalore datacenter → 20-50ms latency for Indian users
- Learning opportunity: full deployment stack (Linux, Nginx, SSL, process management, CI/CD)
- Cost: ~₹400-500/month for a basic droplet

**What this means for the codebase:**
- No schema migration needed — keep current SQLite setup
- Backend stays as-is (Express + better-sqlite3 or sqlite3)
- Add PM2 config for process management
- Add Nginx config for reverse proxy + SSL termination
- Frontend served via Nginx static files or Cloudflare CDN

**Performance plan:**
- Server region: Bangalore (BLR1)
- Process kept alive with PM2/systemd (no cold starts)
- Cloudflare free tier CDN for frontend static assets
- Response caching for catalog endpoints (data rarely changes)

**Alternatives considered & rejected:**
| Option | Why rejected |
|--------|-------------|
| Supabase/Neon (managed Postgres) | Over-engineering for read-heavy catalog; adds migration effort for no perf gain at this scale |
| Turso (edge SQLite) | Great option but skips the infra learning goal |
| Serverless (Render/Railway free) | Cold starts cause 5-30s latency spikes; not suitable for production |

---

*Add new decisions below as they come up.*

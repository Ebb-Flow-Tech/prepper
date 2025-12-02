# Backend Deployment to Fly.io

**Date:** 2025-12-02

## Summary

Deployed the FastAPI backend to Fly.io under the Ebb & Flow Group organization.

## Configuration

| Item | Value |
|------|-------|
| App Name | `reciperepo` |
| Organization | Ebb & Flow Group |
| Region | Singapore (sin) |
| URL | https://reciperepo.fly.dev |
| Admin | https://fly.io/apps/reciperepo |

## Files Created

- `backend/Dockerfile` — Python 3.11 slim image with FastAPI/uvicorn
- `backend/fly.toml` — Fly.io app configuration (shared-cpu-1x, 1GB RAM, auto-stop enabled)

## Secrets Configured

- `DATABASE_URL` — Supabase PostgreSQL connection
- `CORS_ORIGINS` — Allows localhost:3000 and reciperepo.fly.dev

## Endpoints

- Health: `GET /health`
- API: `GET /api/v1/*`

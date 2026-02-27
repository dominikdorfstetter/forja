-- Required PostgreSQL extensions for OpenYapper
-- This file runs automatically via docker-entrypoint-initdb.d on first container start.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

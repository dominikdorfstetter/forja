-- Quick Post / Direct Notes for ActivityPub federation

CREATE TABLE ap_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    body_html TEXT NOT NULL,
    published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    activity_uri TEXT UNIQUE,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ap_notes_site ON ap_notes(site_id, published_at DESC);

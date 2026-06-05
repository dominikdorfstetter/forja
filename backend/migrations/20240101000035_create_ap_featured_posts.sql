-- Featured/Pinned posts for ActivityPub featured collection

CREATE TABLE ap_featured_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID NOT NULL REFERENCES ap_actors(id) ON DELETE CASCADE,
    content_id UUID NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_ap_featured_post UNIQUE (actor_id, content_id)
);

CREATE INDEX idx_ap_featured_posts_actor ON ap_featured_posts(actor_id, position);

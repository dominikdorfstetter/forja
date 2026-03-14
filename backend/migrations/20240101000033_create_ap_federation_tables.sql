-- ActivityPub Federation: followers, activities, delivery queue, comments, blocklists

CREATE TABLE ap_followers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID NOT NULL REFERENCES ap_actors(id) ON DELETE CASCADE,
    follower_actor_uri TEXT NOT NULL,
    follower_inbox_uri TEXT NOT NULL,
    follower_shared_inbox_uri TEXT,
    display_name VARCHAR(255),
    username VARCHAR(255),
    avatar_url TEXT,
    status ap_follower_status NOT NULL DEFAULT 'pending',
    followed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_ap_follower UNIQUE (actor_id, follower_actor_uri)
);

CREATE INDEX idx_ap_followers_actor_id ON ap_followers(actor_id);

CREATE TABLE ap_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL,
    activity_uri TEXT NOT NULL UNIQUE,
    actor_uri TEXT NOT NULL,
    object_uri TEXT,
    object_type VARCHAR(50),
    payload JSONB NOT NULL,
    direction ap_activity_direction NOT NULL,
    status ap_activity_status NOT NULL DEFAULT 'pending',
    content_id UUID REFERENCES contents(id) ON DELETE SET NULL,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ap_activities_site_dir ON ap_activities(site_id, direction, created_at DESC);
CREATE INDEX idx_ap_activities_content ON ap_activities(content_id) WHERE content_id IS NOT NULL;

CREATE TABLE ap_delivery_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    activity_id UUID NOT NULL REFERENCES ap_activities(id) ON DELETE CASCADE,
    target_inbox_uri TEXT NOT NULL,
    status ap_delivery_status NOT NULL DEFAULT 'pending',
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 6,
    last_attempt_at TIMESTAMPTZ,
    next_retry_at TIMESTAMPTZ,
    error_message TEXT,
    queue_backend VARCHAR(10) NOT NULL DEFAULT 'pg',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ap_delivery_pending ON ap_delivery_queue(status, next_retry_at)
    WHERE status IN ('pending', 'failed');

CREATE TABLE ap_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    content_id UUID NOT NULL REFERENCES contents(id) ON DELETE CASCADE,
    author_actor_uri TEXT NOT NULL,
    author_name VARCHAR(255),
    author_avatar_url TEXT,
    activity_uri TEXT NOT NULL UNIQUE,
    in_reply_to_uri TEXT,
    body_html TEXT NOT NULL,
    status ap_comment_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    moderated_at TIMESTAMPTZ,
    moderated_by UUID
);

CREATE INDEX idx_ap_comments_site ON ap_comments(site_id, status, created_at DESC);
CREATE INDEX idx_ap_comments_content ON ap_comments(content_id);

CREATE TABLE ap_blocked_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID NOT NULL REFERENCES ap_actors(id) ON DELETE CASCADE,
    instance_domain VARCHAR(255) NOT NULL,
    reason TEXT,
    blocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_ap_blocked_instance UNIQUE (actor_id, instance_domain)
);

CREATE TABLE ap_blocked_actors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id UUID NOT NULL REFERENCES ap_actors(id) ON DELETE CASCADE,
    blocked_actor_uri TEXT NOT NULL,
    reason TEXT,
    blocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_ap_blocked_actor UNIQUE (actor_id, blocked_actor_uri)
);

BEGIN;

-- 1. Enumerated types
CREATE TYPE content_source_enum    AS ENUM ('study_material', 'syllabus');
CREATE TYPE file_format_enum       AS ENUM ('pdf', 'docx', 'image', 'text');
CREATE TYPE difficulty_enum        AS ENUM ('easy', 'medium', 'hard', 'mixture');
CREATE TYPE generation_status_enum AS ENUM ('pending', 'processing', 'completed', 'failed');
CREATE TYPE question_kind_enum     AS ENUM ('mcq', 'subjective');

-- 2. visitors
CREATE TABLE visitors (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address     INET NOT NULL,
    user_agent     TEXT,
    first_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    visit_count    INTEGER NOT NULL DEFAULT 1 CHECK (visit_count > 0),
    UNIQUE (ip_address)
);

CREATE INDEX idx_visitors_last_seen ON visitors (last_seen_at);

COMMENT ON TABLE visitors IS
    'One row per distinct IP, upserted on each request. Long-lived analytics data — holds no file content.';

-- 3. sessions
CREATE TABLE sessions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visitor_id        UUID REFERENCES visitors(id) ON DELETE CASCADE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_activity_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at        TIMESTAMPTZ NOT NULL,
    purged_at         TIMESTAMPTZ,
    CHECK (expires_at > created_at)
);

CREATE INDEX idx_sessions_visitor ON sessions (visitor_id);
CREATE INDEX idx_sessions_expiry_pending ON sessions (expires_at) WHERE purged_at IS NULL;

COMMENT ON TABLE sessions IS
    'Lifecycle anchor for one upload session. Never stores file bytes or extracted text.';
COMMENT ON COLUMN sessions.purged_at IS
    'Set by the sweep job once the ephemeral payload has been cleared. NULL = still live.';

-- 4. question_categories (static reference data)
CREATE TABLE question_categories (
    code           TEXT PRIMARY KEY,
    kind           question_kind_enum NOT NULL,
    marks          SMALLINT NOT NULL CHECK (marks > 0),
    display_label  TEXT NOT NULL,
    sort_order     SMALLINT NOT NULL
);

-- 5. generations
CREATE TABLE generations (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id            UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    visitor_id            UUID REFERENCES visitors(id) ON DELETE SET NULL,
    parent_generation_id  UUID REFERENCES generations(id) ON DELETE SET NULL,
    ip_address            INET NOT NULL,
    content_source        content_source_enum NOT NULL,
    file_format           file_format_enum NOT NULL,
    target_total_marks    SMALLINT NOT NULL CHECK (target_total_marks > 0),
    difficulty             difficulty_enum NOT NULL DEFAULT 'mixture',
    custom_instructions    TEXT CHECK (char_length(custom_instructions) <= 2000),
    status                 generation_status_enum NOT NULL DEFAULT 'pending',
    turnstile_verified    BOOLEAN NOT NULL DEFAULT false,
    gemini_request_meta   JSONB,
    error_message          TEXT,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at          TIMESTAMPTZ,
    expires_at             TIMESTAMPTZ NOT NULL,
    purged_at              TIMESTAMPTZ,
    CHECK (expires_at > created_at),
    CHECK (completed_at IS NULL OR completed_at >= created_at),
    CHECK (
        (content_source = 'study_material' AND file_format IN ('pdf', 'docx', 'image'))
        OR
        (content_source = 'syllabus' AND file_format IN ('pdf', 'docx', 'image', 'text'))
    )
);

CREATE INDEX idx_generations_session ON generations (session_id);
CREATE INDEX idx_generations_visitor_created ON generations (visitor_id, created_at DESC);
CREATE INDEX idx_generations_ip_created ON generations (ip_address, created_at DESC);
CREATE INDEX idx_generations_expiry_pending ON generations (expires_at) WHERE purged_at IS NULL;
CREATE INDEX idx_generations_parent ON generations (parent_generation_id);

COMMENT ON TABLE generations IS
    'One row per Gemini call. Never stores extracted content or generated paper text — metadata only.';
COMMENT ON COLUMN generations.ip_address IS
    'Denormalized from visitors.ip_address so the rate-limit hot-path query avoids a join and still works if visitor_id is NULL.';
COMMENT ON COLUMN generations.parent_generation_id IS
    'Set on "Regenerate" — points at the generation it re-ran from, forming a lineage within one session.';

-- 6. generation_question_selections
CREATE TABLE generation_question_selections (
    generation_id   UUID NOT NULL REFERENCES generations(id) ON DELETE CASCADE,
    category_code   TEXT NOT NULL REFERENCES question_categories(code),
    question_count  SMALLINT NOT NULL CHECK (question_count > 0),
    PRIMARY KEY (generation_id, category_code)
);

CREATE INDEX idx_gqs_category ON generation_question_selections (category_code);

-- 7. ratings
CREATE TABLE ratings (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    generation_id  UUID NOT NULL UNIQUE REFERENCES generations(id) ON DELETE CASCADE,
    email          TEXT CHECK (email IS NULL OR email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
    score          SMALLINT NOT NULL CHECK (score BETWEEN 1 AND 5),
    comment        TEXT CHECK (char_length(comment) <= 1000),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ratings_email_lower ON ratings (lower(email)) WHERE email IS NOT NULL;
CREATE INDEX idx_ratings_created ON ratings (created_at);

COMMENT ON TABLE ratings IS
    'One rating per generation. score is 1-5; if the UI is thumbs up/down, map down/up to 1/5.';
COMMENT ON COLUMN ratings.generation_id IS
    'UNIQUE — a generation can be rated once; the app should upsert (update score/comment) on re-rating.';

-- 8. Trigger: auto-touch ratings.updated_at
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ratings_updated_at
BEFORE UPDATE ON ratings
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 9. Helper: validate a generation's marks cap
CREATE OR REPLACE FUNCTION validate_generation_marks(p_generation_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_target  SMALLINT;
    v_actual  INTEGER;
BEGIN
    SELECT target_total_marks INTO v_target FROM generations WHERE id = p_generation_id;

    SELECT COALESCE(SUM(gqs.question_count * qc.marks), 0) INTO v_actual
    FROM generation_question_selections gqs
    JOIN question_categories qc ON qc.code = gqs.category_code
    WHERE gqs.generation_id = p_generation_id;

    RETURN v_actual = v_target;
END;
$$ LANGUAGE plpgsql;

-- 10. Helper: purge expired sessions
CREATE OR REPLACE FUNCTION purge_expired_sessions()
RETURNS SETOF UUID AS $$
DECLARE
    v_session_id UUID;
BEGIN
    FOR v_session_id IN
        SELECT id FROM sessions
        WHERE expires_at < now() AND purged_at IS NULL
        FOR UPDATE SKIP LOCKED
    LOOP
        UPDATE generations SET purged_at = now()
        WHERE session_id = v_session_id AND purged_at IS NULL;

        UPDATE sessions SET purged_at = now()
        WHERE id = v_session_id;

        RETURN NEXT v_session_id;
    END LOOP;
    RETURN;
END;
$$ LANGUAGE plpgsql;

-- 11. Seed data
INSERT INTO question_categories (code, kind, marks, display_label, sort_order) VALUES
    ('MCQ_1',  'mcq',        1,  'MCQ (1 mark)',           1),
    ('SUB_1',  'subjective', 1,  'Short Answer (1 mark)',  2),
    ('SUB_2',  'subjective', 2,  'Short Answer (2 marks)', 3),
    ('SUB_3',  'subjective', 3,  'Short Answer (3 marks)', 4),
    ('SUB_4',  'subjective', 4,  'Short Answer (4 marks)', 5),
    ('SUB_5',  'subjective', 5,  'Short Answer (5 marks)', 6),
    ('SUB_6',  'subjective', 6,  'Short Answer (6 marks)', 7),
    ('SUB_8',  'subjective', 8,  'Long Answer (8 marks)',  8),
    ('SUB_10', 'subjective', 10, 'Long Answer (10 marks)', 9),
    ('SUB_15', 'subjective', 15, 'Long Answer (15 marks)', 10),
    ('SUB_20', 'subjective', 20, 'Long Answer (20 marks)', 11)
ON CONFLICT (code) DO NOTHING;

COMMIT;

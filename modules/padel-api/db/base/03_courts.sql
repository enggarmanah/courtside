DROP TABLE IF EXISTS courts CASCADE;

CREATE TABLE courts (
    id          UUID PRIMARY KEY,
    club_id     UUID NOT NULL REFERENCES clubs(id),
    name        VARCHAR(255) NOT NULL,
    created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);
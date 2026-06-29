DROP TABLE IF EXISTS prices CASCADE;

CREATE TABLE prices (
    id           UUID PRIMARY KEY,
    club_id      UUID NOT NULL REFERENCES clubs(id),
    day          VARCHAR(3) NOT NULL,
    time         VARCHAR(5) NOT NULL,
    start_period TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_period   TIMESTAMPTZ,
    UNIQUE (club_id, day, time, start_period, end_period),
    price        DECIMAL(12, 2),
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
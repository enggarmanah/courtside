DROP TABLE IF EXISTS clubs CASCADE;

CREATE TABLE clubs (
    id             UUID PRIMARY KEY,
    name           VARCHAR(255) NOT NULL,
    sub_name       VARCHAR(255),
    address        TEXT,
    email          VARCHAR(255),
    whatsapp       VARCHAR(50),
    instagram      VARCHAR(255),
    logo_path      VARCHAR(500),
    lat            DECIMAL(10, 7),
    lng            DECIMAL(10, 7),
    link_map       TEXT,
    opening_hours  JSONB,
    opening_date   DATE,
    location_id    UUID NOT NULL REFERENCES locations(id),
    price          DECIMAL(12, 2),
    created_at     TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMP NOT NULL DEFAULT NOW()
);
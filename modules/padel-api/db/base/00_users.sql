DROP TABLE IF EXISTS users CASCADE;

CREATE TABLE public.users (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(255) NOT NULL,
    email      VARCHAR(255) NOT NULL UNIQUE,
    userid     VARCHAR(100) NOT NULL UNIQUE,
    password   VARCHAR(255) NOT NULL,
    status     CHAR(1) DEFAULT 'A',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
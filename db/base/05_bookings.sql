DROP TABLE IF EXISTS bookings CASCADE;

CREATE TABLE bookings (
    id           UUID PRIMARY KEY,
    club_id      UUID NOT NULL REFERENCES clubs(id),
    court_id     UUID NOT NULL REFERENCES courts(id),
    booking_time TIMESTAMP NOT NULL,
    UNIQUE (club_id, court_id, booking_time),
    price        DECIMAL(12, 2),
    created_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
);
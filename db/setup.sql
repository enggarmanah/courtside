CREATE USER padelitics WITH LOGIN PASSWORD 'P@del1tic5';

GRANT padelitics TO postgres;

CREATE DATABASE padelitics WITH OWNER padelitics;

\c padelitics padelitics;

\i base/01_locations.sql
\i base/02_clubs.sql
\i base/03_courts.sql
\i base/04_prices.sql
\i base/05_bookings.sql
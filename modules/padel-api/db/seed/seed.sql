-- Admin user (password: password123)
INSERT INTO users (id, name, email, userid, password)
VALUES (
    gen_random_uuid(),
    'Admin Padelitics',
    'admin@padel.com',
    'admin',
    '$2a$10$xk9c1.tZlUUr1Wh48cWoo.scKKOsOFwY1FyX8eCIAgjJ5P/T1AqIC'
);
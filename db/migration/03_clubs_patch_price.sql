UPDATE clubs
SET price = max_prices.max_price
FROM (
    SELECT club_id, MAX(price) AS max_price
    FROM prices
    GROUP BY club_id
) AS max_prices
WHERE clubs.id = max_prices.club_id;

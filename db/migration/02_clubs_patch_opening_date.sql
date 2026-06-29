UPDATE clubs
SET opening_date = sub.min_date
FROM (
    SELECT
        c.id,
        MIN((elem.value->>'created_at')::date) AS min_date
    FROM clubs c
    CROSS JOIN LATERAL jsonb_array_elements(c.opening_hours) AS elem
    WHERE c.opening_hours IS NOT NULL AND c.opening_hours != '[]'::jsonb
    GROUP BY c.id
) AS sub
WHERE clubs.id = sub.id
  AND clubs.opening_date IS NULL;
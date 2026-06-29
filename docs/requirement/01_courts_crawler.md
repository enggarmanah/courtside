create crawler for each club in table clubs crawl its courts, court_prices, bookings. when the crawler is executed we run based on today date. 

crawl https://api.courtside.id/api/mobile/booking-court/court_id/list-court-available
based on reference @booking-2.txt, 

request:
{
  "duration": 60, (static)
  "date": "2026-06-26", -> today date
  "start_hours": "23.00" -> iterate from clubs.opening_hours from open_hours to close_hours (every 1 hours, e.g: 06.00, 07.00 .. etc)
}

reference for clubs.opening_hours:
[{
    "id": "a125d4a8-45e5-4145-b83c-7c6df934894e",
    "mitra_id": "9fad3cdd-ac98-40d6-82e5-bed92ddd62da",
    "key": "sun",
    "open_hours": "06.00",
    "close_hours": "24.00",
    "closed": 0,
    "order": 1,
    "created_at": "2026-02-23T09:22:16.000000Z",
    "updated_at": "2026-02-23T09:22:16.000000Z"
}]

response:
{
  "data": [
    {
      "id": "a00213ea-5a03-4837-81da-aea876b067a0",
      "name": "Court 1", -> courts.name
      "icon_path": "court\/a00213ea-5a03-4837-81da-aea876b067a0\/icon\/",
      "icon_name": "1b78da56-1d96-46a9-8ed6-f2d3c1c657db.png",
      "duration": 60,
      "date": "2026-06-26",
      "start_hour": "23.00", court_prices.time
      "end_hour": "00.00",
      "price": 375000, -> court_prices.price
      "discount_persen": 0,
      "discount_nominal": 0,
      "ori_price": 375000,
      "is_openplay": false,
      "insurance_price": 5000
    }
  ]
}

for table bookings we fill from data thats not available. since this API only return available courts.
big picture logic
1. iterate clubs and call this api for each club https://api.courtside.id/api/mobile/booking-court/court_id/list-court-available
2. aggregate data for this clubs for the whole day to construct the data before we extract the data that we need based on our tables
4. based on response we parse to identify courts in the clubs (since we iterate for 1 day that means there will be time when all courts is available (even though in different time, we just need to aggregate) and we register based on this date)
5. similarly for court_prices (follow pattern for item 2)
6. once courts and courts_prices has been updated in the DB. we inject bookings data for each courts when that court name is not available in the api result (since it has been booked). bookings_booking_time: from request date parameter + time when we iterate and their data not available. 
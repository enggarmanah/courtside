table: locations (reference location.txt)
id: UUID
name
created_at
updated_at

table: clubs (reference: club.txt)
id: UUID
name
address
email
whatsapp
instagram
logo_path
lat
lng
link_map
opening_hours: json
location_id:
price
created_at
updated_at

table: courts
id: UUID
name
created_at
updated_at

table: court_prices
id: UUID
court_id: refer to courts.id
time: e.g: 06.00, 07.00
price: 
created_at
updated_at

table: bookings
id
club_id: refer to clubs.id
court_id: refer to courts.id
booking_time
price
created_at
updated_at
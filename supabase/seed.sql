-- Seed Ithaca and NYC venues for MVP. Wide enough to support both launch cities.
insert into public.venues (name, category, neighborhood, location, opentable_rid, resy_id) values
  -- Ithaca / Collegetown
  ('Maxie''s Supper Club', 'bar',        'Collegetown', st_makepoint(-76.4854, 42.4423)::geography, NULL, NULL),
  ('Hai Hong',            'restaurant', 'Collegetown', st_makepoint(-76.4862, 42.4419)::geography, NULL, NULL),
  ('Collegetown Bagels',  'cafe',       'Collegetown', st_makepoint(-76.4857, 42.4426)::geography, NULL, NULL),
  ('The Watershed',       'bar',        'Downtown',    st_makepoint(-76.4961, 42.4391)::geography, NULL, NULL),
  ('Coal Yard',           'bar',        'Downtown',    st_makepoint(-76.4985, 42.4400)::geography, NULL, NULL),
  ('Gimme Coffee',        'cafe',       'Downtown',    st_makepoint(-76.4970, 42.4404)::geography, NULL, NULL),
  ('Moosewood',           'restaurant', 'Downtown',    st_makepoint(-76.4980, 42.4385)::geography, NULL, NULL),
  ('Ithaca Bakery',       'cafe',       'Downtown',    st_makepoint(-76.4998, 42.4421)::geography, NULL, NULL),
  ('Argos Inn',           'bar',        'Downtown',    st_makepoint(-76.4940, 42.4408)::geography, NULL, NULL),
  ('Six Mile Creek',      'bar',        'Downtown',    st_makepoint(-76.4965, 42.4395)::geography, NULL, NULL),
  -- NYC / East Village
  ('Death & Co',          'bar',        'East Village', st_makepoint(-73.9846, 40.7263)::geography, NULL, NULL),
  ('Wayla',               'restaurant', 'East Village', st_makepoint(-73.9849, 40.7218)::geography, NULL, NULL),
  ('Veselka',             'restaurant', 'East Village', st_makepoint(-73.9879, 40.7281)::geography, NULL, NULL),
  ('Abraço',              'cafe',       'East Village', st_makepoint(-73.9836, 40.7257)::geography, NULL, NULL),
  ('Please Don''t Tell',  'bar',        'East Village', st_makepoint(-73.9844, 40.7269)::geography, NULL, NULL),
  ('Superiority Burger',  'restaurant', 'East Village', st_makepoint(-73.9824, 40.7251)::geography, NULL, NULL),
  -- NYC / Lower East Side
  ('Attaboy',             'bar',        'LES', st_makepoint(-73.9919, 40.7164)::geography, NULL, NULL),
  ('Russ & Daughters',    'cafe',       'LES', st_makepoint(-73.9897, 40.7212)::geography, NULL, NULL),
  ('Wildair',             'restaurant', 'LES', st_makepoint(-73.9870, 40.7204)::geography, NULL, NULL),
  ('Forsythia',           'restaurant', 'LES', st_makepoint(-73.9889, 40.7173)::geography, NULL, NULL),
  ('Mr. Fong''s',         'bar',        'LES', st_makepoint(-73.9947, 40.7152)::geography, NULL, NULL),
  -- NYC / Upper West Side
  ('Jacob''s Pickles',    'restaurant', 'UWS', st_makepoint(-73.9783, 40.7903)::geography, NULL, NULL),
  ('Manhattan Diner',     'restaurant', 'UWS', st_makepoint(-73.9776, 40.7842)::geography, NULL, NULL),
  ('Sant Ambroeus',       'cafe',       'UWS', st_makepoint(-73.9755, 40.7813)::geography, NULL, NULL),
  ('The Dead Poet',       'bar',        'UWS', st_makepoint(-73.9762, 40.7866)::geography, NULL, NULL);

-- seed.sql — curated Gaborone places (applied by `npx supabase db reset`).
-- Mirror of src/map/pois.ts. lng/lat in WGS84; geom is generated automatically.
insert into public.pois (name, cat, lng, lat, q) values
  ('Three Dikgosi Monument','monument',25.9186,-24.6554,'dikgosi three chiefs cbd'),
  ('Parliament of Botswana','monument',25.9135,-24.6566,'national assembly parliament government'),
  ('Main Mall','landmark',25.9119,-24.6571,'main mall pedestrian government enclave'),
  ('Game City Mall','shopping',25.8950,-24.6826,'game city shopping kgale'),
  ('Riverwalk Mall','shopping',25.9520,-24.6610,'riverwalk shopping tlokweng road'),
  ('Airport Junction Mall','shopping',25.9165,-24.6082,'airport junction shopping'),
  ('Rail Park Mall','shopping',25.9115,-24.6505,'rail park station shopping'),
  ('Gaborone Station','transit',25.9117,-24.6539,'railway train station'),
  ('Sir Seretse Khama Intl Airport','airport',25.9182,-24.5553,'airport gbe flight'),
  ('University of Botswana','education',25.9384,-24.6644,'ub university campus'),
  ('Botswana National Stadium','sport',25.9249,-24.6478,'national stadium football'),
  ('Kgale Hill','nature',25.8836,-24.6925,'kgale hill summit hike viewpoint'),
  ('Gaborone Dam','water',25.9000,-24.7167,'dam reservoir notwane'),
  ('National Botanical Garden','nature',25.9230,-24.6470,'botanical garden'),
  ('Avani Gaborone','hotel',25.9290,-24.6530,'avani gaborone sun hotel casino'),
  ('Gaborone Game Reserve','nature',25.9600,-24.6500,'game reserve wildlife')
on conflict do nothing;

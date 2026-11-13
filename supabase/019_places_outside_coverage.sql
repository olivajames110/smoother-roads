-- Smoother Roads: remove places that sit outside their area's coverage (the road snap pushed them
-- over the edge). Paste into the Supabase SQL Editor and run once.

delete from public.area_pois where id in (
  '5f91cd77-968d-4e83-bee9-64005ff9f421', -- Wantagh Park (Farmingdale/Massapequa)
  '03b3adf7-8751-4a3b-a781-34b449f3be79', -- GMHBA Stadium (Geelong)
  'f74779c9-9c03-4a45-91ca-1fb8a28259f1', -- Case Western Reserve University (Lyndhurst)
  'f735137e-8687-464d-ac39-a760a388b83f', -- Ambler Park (Lyndhurst)
  'e4d7dc67-f371-41d9-9151-ab6722629950', -- Kerruish Park (Lyndhurst)
  'eacc052c-da3b-4009-a4a4-8316b79f96de'  -- Hogle Zoo (Salt Lake City)
);

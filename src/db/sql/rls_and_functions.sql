-- ==============================================================================
-- WHISKYTIX: Row Level Security (RLS) & Atomaire Voorraad Functies
-- Uitvoeren in de Supabase SQL Editor of via migraties
-- ==============================================================================

-- 1. Inschakelen van Row Level Security op alle 9 relationele tabellen
ALTER TABLE festivals ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE issued_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- 2. Publieke Leesrechten (Festival Websites & Checkouts)
-- Bezoekers op de festivalwebsites mogen actieve edities, sessies en tickettypes inzien
CREATE POLICY "Public Read Festivals" ON festivals
  FOR SELECT USING (true);

CREATE POLICY "Public Read Active Sessions" ON sessions
  FOR SELECT USING (is_active = true);

CREATE POLICY "Public Read Available Ticket Types" ON ticket_types
  FOR SELECT USING (true);

-- 3. Service Role & Admin Volledige Toegang
-- De Fastify backend opereert met de Supabase Service Role Key en heeft overal toegang toe
CREATE POLICY "Service Role Full Access Festivals" ON festivals
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service Role Full Access Sessions" ON sessions
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service Role Full Access Ticket Types" ON ticket_types
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service Role Full Access Discount Codes" ON discount_codes
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service Role Full Access Orders" ON orders
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service Role Full Access Order Items" ON order_items
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service Role Full Access Issued Tickets" ON issued_tickets
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service Role Full Access Scan Logs" ON scan_logs
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service Role Full Access Users" ON users
  FOR ALL USING (auth.role() = 'service_role');

-- 4. Scanner Toegangsrechten (Vrijwilligers aan de deur)
-- Scanners mogen tickets valideren en scan_logs toevoegen
CREATE POLICY "Scanner Read Issued Tickets" ON issued_tickets
  FOR SELECT USING (auth.jwt() ->> 'role' IN ('scanner', 'admin', 'organizer'));

CREATE POLICY "Scanner Update Checked In" ON issued_tickets
  FOR UPDATE USING (auth.jwt() ->> 'role' IN ('scanner', 'admin', 'organizer'))
  WITH CHECK (auth.jwt() ->> 'role' IN ('scanner', 'admin', 'organizer'));

CREATE POLICY "Scanner Insert Scan Logs" ON scan_logs
  FOR INSERT WITH CHECK (auth.jwt() ->> 'role' IN ('scanner', 'admin', 'organizer'));

-- ==============================================================================
-- 5. Atomaire Functie: reserve_ticket_stock
-- Vergrendelt tickets en sessiecapaciteit zonder race-conditions
-- ==============================================================================
CREATE OR REPLACE FUNCTION reserve_ticket_stock(
  p_session_id UUID,
  p_ticket_type_id TEXT,
  p_quantity INT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_session_max INT;
  v_session_sold INT;
  v_ticket_available INT;
  v_ticket_sold INT;
BEGIN
  -- 1. Lock en controleer sessie zaalcapaciteit
  IF p_session_id IS NOT NULL THEN
    SELECT capacity_max, capacity_sold
    INTO v_session_max, v_session_sold
    FROM sessions
    WHERE id = p_session_id
    FOR UPDATE;

    IF (v_session_sold + p_quantity) > v_session_max THEN
      -- Zaalcapaciteit overschreden!
      RETURN FALSE;
    END IF;
  END IF;

  -- 2. Lock en controleer tickettype voorraad
  SELECT total_available, total_sold
  INTO v_ticket_available, v_ticket_sold
  FROM ticket_types
  WHERE id = p_ticket_type_id
  FOR UPDATE;

  IF (v_ticket_sold + p_quantity) > v_ticket_available THEN
    -- Tickettype uitverkocht!
    RETURN FALSE;
  END IF;

  -- 3. Verhoog de verkoop/reserveringsteller atomair
  IF p_session_id IS NOT NULL THEN
    UPDATE sessions
    SET capacity_sold = capacity_sold + p_quantity
    WHERE id = p_session_id;
  END IF;

  UPDATE ticket_types
  SET total_sold = total_sold + p_quantity
  WHERE id = p_ticket_type_id;

  RETURN TRUE;
END;
$$;

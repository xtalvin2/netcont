
-- Allow authenticated admins full write access to packages
DROP POLICY IF EXISTS "Admin full access to packages" ON packages;
DROP POLICY IF EXISTS "Authenticated users can manage packages" ON packages;

CREATE POLICY "Authenticated users can manage packages"
  ON packages
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Also fix system_settings so authenticated admins can update it
DROP POLICY IF EXISTS "Authenticated users can manage settings" ON system_settings;

CREATE POLICY "Authenticated users can manage settings"
  ON system_settings
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

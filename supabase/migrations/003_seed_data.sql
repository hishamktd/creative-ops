-- Insert sample badges for gamification
INSERT INTO badges (name, description, icon, xp_required) VALUES
  ('First Task', 'Complete your first task', '🎯', 10),
  ('Task Master', 'Complete 10 tasks', '⭐', 100),
  ('Team Player', 'Collaborate on 5 projects', '🤝', 150),
  ('Speed Demon', 'Complete 5 tasks in one day', '⚡', 200),
  ('Consistent', 'Work for 7 consecutive days', '📅', 250),
  ('Asset Guru', 'Upload 50 assets', '📁', 300),
  ('Feedback Pro', 'Give 20 meaningful comments', '💬', 150),
  ('Project Leader', 'Create and complete a project', '👑', 500),
  ('Billing Expert', 'Generate 10 invoices', '💰', 400),
  ('Early Bird', 'Start work before 8 AM for 5 days', '🌅', 100);

-- Function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'team_member'::user_role)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Function to track team activity
CREATE OR REPLACE FUNCTION public.log_activity(
  p_user_id UUID,
  p_activity_type activity_type,
  p_entity_type TEXT DEFAULT NULL,
  p_entity_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  activity_id UUID;
BEGIN
  INSERT INTO team_activity (user_id, activity_type, entity_type, entity_id, metadata)
  VALUES (p_user_id, p_activity_type, p_entity_type, p_entity_id, p_metadata)
  RETURNING id INTO activity_id;

  RETURN activity_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to award badge to user
CREATE OR REPLACE FUNCTION public.award_badge(
  p_user_id UUID,
  p_badge_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  INSERT INTO user_badges (user_id, badge_id)
  VALUES (p_user_id, p_badge_id)
  ON CONFLICT (user_id, badge_id) DO NOTHING;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check and award badges based on XP
CREATE OR REPLACE FUNCTION public.check_and_award_xp_badges()
RETURNS TRIGGER AS $$
DECLARE
  badge RECORD;
BEGIN
  FOR badge IN
    SELECT b.id FROM badges b
    LEFT JOIN user_badges ub ON ub.badge_id = b.id AND ub.user_id = NEW.id
    WHERE b.xp_required <= NEW.xp_points
    AND ub.id IS NULL
  LOOP
    PERFORM award_badge(NEW.id, badge.id);
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to award badges when XP increases
CREATE TRIGGER on_xp_increase
  AFTER UPDATE OF xp_points ON users
  FOR EACH ROW
  WHEN (NEW.xp_points > OLD.xp_points)
  EXECUTE FUNCTION public.check_and_award_xp_badges();

-- Function to increment project revision count
CREATE OR REPLACE FUNCTION public.increment_revision_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.version > OLD.version) THEN
    UPDATE projects
    SET revision_count = revision_count + 1
    WHERE id = (SELECT project_id FROM assets WHERE id = NEW.asset_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to track revisions
CREATE TRIGGER on_asset_version_change
  AFTER INSERT OR UPDATE ON asset_versions
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_revision_count();

-- Function to create invoice number
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TEXT AS $$
DECLARE
  next_num INTEGER;
  invoice_num TEXT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 5) AS INTEGER)), 0) + 1
  INTO next_num
  FROM invoices
  WHERE invoice_number ~ '^INV-[0-9]+$';

  invoice_num := 'INV-' || LPAD(next_num::TEXT, 5, '0');
  RETURN invoice_num;
END;
$$ LANGUAGE plpgsql;

-- Story 2.5: Normalize translation preference values created before
-- TranslationLanguageSelector enforced ISO codes.

WITH invalid_preferences AS (
  SELECT id
  FROM "users"
  WHERE COALESCE(jsonb_typeof("preferences"), 'object') = 'object'
    AND (
      NOT ("preferences" ? 'preferredLanguage')
      OR jsonb_typeof("preferences"->'preferredLanguage') <> 'string'
      OR ("preferences"->>'preferredLanguage') NOT IN (
        'en','ja','es','fr','de','zh','ko','pt','ru','ar',
        'it','nl','pl','tr','vi','th','id','hi','sv','no'
      )
    )
)
UPDATE "users"
SET "preferences" = jsonb_set(
  COALESCE("preferences", '{}'::jsonb),
  '{preferredLanguage}',
  to_jsonb('en'::text),
  true
)
WHERE id IN (SELECT id FROM invalid_preferences);

CREATE TABLE data_sources (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, publisher TEXT, url TEXT NOT NULL,
  license TEXT, attribution_text TEXT
);
CREATE TABLE data_releases (
  id TEXT PRIMARY KEY, source_id TEXT REFERENCES data_sources(id), version TEXT NOT NULL,
  published_at TIMESTAMPTZ, imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  raw_checksum TEXT NOT NULL, status TEXT NOT NULL, import_report_json JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE TABLE characters (
  id BIGSERIAL PRIMARY KEY, char TEXT UNIQUE NOT NULL, codepoint INTEGER NOT NULL,
  traditional_form TEXT, radical TEXT, structure TEXT, modern_strokes INTEGER,
  candidate_status TEXT, rarity_band TEXT, input_difficulty NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE character_strokes (
  id BIGSERIAL PRIMARY KEY, character_id BIGINT NOT NULL REFERENCES characters(id), system TEXT NOT NULL,
  strokes INTEGER NOT NULL, source_release_id TEXT REFERENCES data_releases(id), confidence TEXT NOT NULL, review_status TEXT NOT NULL
);
CREATE TABLE character_readings (
  id BIGSERIAL PRIMARY KEY, character_id BIGINT NOT NULL REFERENCES characters(id), language TEXT NOT NULL,
  system TEXT NOT NULL, value TEXT NOT NULL, tone TEXT, source_release_id TEXT REFERENCES data_releases(id),
  confidence TEXT NOT NULL, review_status TEXT NOT NULL
);
CREATE TABLE character_elements (
  id BIGSERIAL PRIMARY KEY, character_id BIGINT NOT NULL REFERENCES characters(id), school TEXT NOT NULL,
  element TEXT NOT NULL, source_release_id TEXT REFERENCES data_releases(id), confidence TEXT NOT NULL, review_status TEXT NOT NULL
);
CREATE TABLE character_meanings (
  id BIGSERIAL PRIMARY KEY, character_id BIGINT NOT NULL REFERENCES characters(id), kind TEXT NOT NULL,
  text TEXT NOT NULL, sentiment TEXT, source_release_id TEXT REFERENCES data_releases(id), method TEXT, confidence TEXT NOT NULL, review_status TEXT NOT NULL
);
CREATE TABLE character_tags (
  character_id BIGINT NOT NULL REFERENCES characters(id), tag TEXT NOT NULL, weight NUMERIC NOT NULL DEFAULT 1,
  source_release_id TEXT REFERENCES data_releases(id), method TEXT, review_status TEXT NOT NULL, PRIMARY KEY(character_id, tag)
);
CREATE TABLE registration_evidence (
  id BIGSERIAL PRIMARY KEY, character_id BIGINT NOT NULL REFERENCES characters(id), evidence_type TEXT NOT NULL,
  result TEXT NOT NULL, note TEXT, source_release_id TEXT REFERENCES data_releases(id), checked_at TIMESTAMPTZ
);
CREATE TABLE name_statistics (
  id BIGSERIAL PRIMARY KEY, text TEXT NOT NULL, statistic_type TEXT NOT NULL, gender_group TEXT,
  period_start DATE, period_end DATE, rank INTEGER, count INTEGER, population_scope TEXT,
  source_release_id TEXT REFERENCES data_releases(id), source_page TEXT
);
CREATE TABLE homophone_rules (
  id BIGSERIAL PRIMARY KEY, language TEXT NOT NULL, normalized_pronunciation TEXT NOT NULL,
  matched_text TEXT NOT NULL, severity TEXT NOT NULL, reason TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true, review_status TEXT NOT NULL
);
CREATE TABLE scoring_profiles (
  id TEXT PRIMARY KEY, version TEXT NOT NULL, weights_json JSONB NOT NULL, thresholds_json JSONB NOT NULL,
  active_from TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE search_snapshots (
  id BIGSERIAL PRIMARY KEY, public_token TEXT UNIQUE NOT NULL, constraints_json JSONB NOT NULL,
  dataset_release_id TEXT REFERENCES data_releases(id), scoring_profile_id TEXT REFERENCES scoring_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), expires_at TIMESTAMPTZ
);
CREATE INDEX character_strokes_lookup ON character_strokes(system, strokes, character_id);
CREATE INDEX character_elements_lookup ON character_elements(school, element, character_id);

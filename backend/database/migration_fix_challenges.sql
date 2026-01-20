-- Migration to align challenges table with ChallengeModel.js
USE fullstack_test_portal;

ALTER TABLE challenges 
  CHANGE COLUMN html_template expected_html TEXT,
  CHANGE COLUMN css_template expected_css TEXT,
  CHANGE COLUMN js_template expected_js TEXT,
  CHANGE COLUMN test_cases instructions TEXT,
  CHANGE COLUMN expected_output instructions_legacy TEXT, -- or just drop if instructions covers it
  CHANGE COLUMN passing_threshold passing_threshold_old JSON, -- check type
  CHANGE COLUMN points points INT DEFAULT 100,
  CHANGE COLUMN hints hints JSON;

-- Note: The current table seems to have very different columns. 
-- Let's check the DESCRIBE output again to be absolutely sure of the mapping.

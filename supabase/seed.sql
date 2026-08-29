-- Starter templates seeded per Phase 1.3. Run after schema.sql.

insert into templates (name, use_case, definition, thumbnail) values
(
  'Webhook -> Filter -> Send Email',
  'Notify yourself only when an inbound webhook payload meets a condition',
  '[
    {"key":"step1","type":"filter","config":{"field":"trigger.amount","operator":"greater_than","value":"100"}},
    {"key":"step2","type":"send_email","config":{"to":"{{trigger.email}}","subject":"New qualifying event","body":"You received a payload with amount {{trigger.amount}}."}}
  ]'::jsonb,
  null
),
(
  'Form submission -> AI Action (summarize) -> Send Email',
  'Summarize a public form submission with AI and email yourself the summary',
  '[
    {"key":"step1","type":"ai_action","config":{"mode":"summarize","instruction":"Summarize this form submission in 2-3 sentences.","input":"{{trigger.message}}"}},
    {"key":"step2","type":"send_email","config":{"to":"{{trigger.email}}","subject":"New form submission summary","body":"{{step1.output}}"}}
  ]'::jsonb,
  null
),
(
  'Daily schedule -> HTTP Request -> Send Email',
  'Poll an endpoint every day and email the result',
  '[
    {"key":"step1","type":"http_request","config":{"method":"GET","url":"https://example.com/api/status"}},
    {"key":"step2","type":"send_email","config":{"to":"","subject":"Daily status check","body":"Status endpoint returned: {{step1.output}}"}}
  ]'::jsonb,
  null
),
(
  'Webhook -> Transform -> HTTP Request',
  'Reshape an inbound payload and forward it to another system',
  '[
    {"key":"step1","type":"transform_data","config":{"operation":"extract_field","path":"trigger.data.id"}},
    {"key":"step2","type":"http_request","config":{"method":"POST","url":"https://example.com/api/forward","body":"{\"id\":\"{{step1.output}}\"}"}}
  ]'::jsonb,
  null
),
(
  'Webhook -> AI Action (classify) -> Filter -> Send Email',
  'Classify an inbound support ticket and only alert on urgent ones',
  '[
    {"key":"step1","type":"ai_action","config":{"mode":"classify","instruction":"Classify the urgency of this message.","categories":["urgent","normal","low"],"input":"{{trigger.message}}"}},
    {"key":"step2","type":"filter","config":{"field":"step1.output","operator":"equals","value":"urgent"}},
    {"key":"step3","type":"send_email","config":{"to":"","subject":"Urgent ticket received","body":"{{trigger.message}}"}}
  ]'::jsonb,
  null
),
(
  -- Phase 4: the first template that actually uses graph branching (Master Spec section 5)
  -- rather than the linear array format every earlier template still uses on purpose —
  -- old-format templates keep working via lib/engine/graph.ts's automatic conversion, so
  -- there was no need to migrate them; this one exists specifically to show a new workspace
  -- what a real true/false branch looks like on the canvas as soon as they open it.
  'Webhook -> Filter (branching) -> Send Email',
  'Route high-value leads to a priority email and everyone else to a standard one — a single condition, two outcomes',
  '{
    "nodes": [
      {"key":"check","type":"filter","config":{"field":"trigger.deal_value","operator":"greater_than","value":"10000"},"position":{"x":260,"y":40}},
      {"key":"priority_email","type":"send_email","config":{"to":"{{trigger.owner_email}}","subject":"High-value lead — respond within the hour","body":"{{trigger.name}} just came in at {{trigger.deal_value}}."},"position":{"x":80,"y":220}},
      {"key":"standard_email","type":"send_email","config":{"to":"{{trigger.owner_email}}","subject":"New lead","body":"{{trigger.name}} just came in."},"position":{"x":440,"y":220}}
    ],
    "edges": [
      {"id":"check-true","source":"check","target":"priority_email","branch":"true"},
      {"id":"check-false","source":"check","target":"standard_email","branch":"false"}
    ]
  }'::jsonb,
  null
);

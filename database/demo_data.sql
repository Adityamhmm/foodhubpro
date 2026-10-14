-- Optional sample catalog for a disposable/demo database. Inserts only; no existing rows are changed.
USE foodhub_db;

INSERT IGNORE INTO menu_categories (id, name, sort_order) VALUES
    ('10000000-0000-4000-8000-000000000001', 'Demo · From the oven', 10),
    ('10000000-0000-4000-8000-000000000002', 'Demo · Small plates', 20);

INSERT IGNORE INTO menu_tags (id, name) VALUES
    ('20000000-0000-4000-8000-000000000001', 'Demo favorite'),
    ('20000000-0000-4000-8000-000000000002', 'Demo shareable');

INSERT IGNORE INTO restaurant_tables (table_number, label, is_active) VALUES
    (9001, 'Demo table 1', TRUE),
    (9002, 'Demo table 2', TRUE);

INSERT IGNORE INTO menu_items
    (id, name, category, category_id, description, food_type, price, available, tags)
VALUES
    ('30000000-0000-4000-8000-000000000001', 'Demo herb focaccia', 'Demo · From the oven',
     '10000000-0000-4000-8000-000000000001', 'Rosemary oil, sea salt, warm from the oven.',
     'Vegan', 240.00, TRUE, JSON_ARRAY('Demo favorite')),
    ('30000000-0000-4000-8000-000000000002', 'Demo roasted carrots', 'Demo · Small plates',
     '10000000-0000-4000-8000-000000000002', 'Slow roasted with lemon and toasted seeds.',
     'Vegetarian', 310.00, TRUE, JSON_ARRAY('Demo shareable'));

INSERT IGNORE INTO menu_item_tags (menu_item_id, tag_id) VALUES
    ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001'),
    ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002');

INSERT IGNORE INTO tax_rules (id, name, percent, is_active) VALUES
    ('40000000-0000-4000-8000-000000000001', 'Demo sample tax', 5.000, TRUE);

-- Run only after V2 has completed and every V2 preflight count is zero.
-- These statements add constraints only. They do not alter stored values or delete rows.
USE foodhub_db;

ALTER TABLE menu_items
    ADD CONSTRAINT fk_foodhub_menu_category FOREIGN KEY (category_id)
        REFERENCES menu_categories(id);

ALTER TABLE menu_item_tags
    ADD CONSTRAINT fk_foodhub_item_tags_item FOREIGN KEY (menu_item_id)
        REFERENCES menu_items(id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_foodhub_item_tags_tag FOREIGN KEY (tag_id)
        REFERENCES menu_tags(id) ON DELETE CASCADE;

ALTER TABLE orders
    ADD CONSTRAINT fk_foodhub_orders_table FOREIGN KEY (table_number)
        REFERENCES restaurant_tables(table_number);
ALTER TABLE requests
    ADD CONSTRAINT fk_foodhub_requests_table FOREIGN KEY (table_number)
        REFERENCES restaurant_tables(table_number);
ALTER TABLE table_sessions
    ADD CONSTRAINT fk_foodhub_sessions_table FOREIGN KEY (table_number)
        REFERENCES restaurant_tables(table_number);
ALTER TABLE bills
    ADD CONSTRAINT fk_foodhub_bills_table FOREIGN KEY (table_number)
        REFERENCES restaurant_tables(table_number);
ALTER TABLE customer_messages
    ADD CONSTRAINT fk_foodhub_messages_table FOREIGN KEY (table_number)
        REFERENCES restaurant_tables(table_number);

ALTER TABLE order_items
    ADD CONSTRAINT fk_foodhub_order_items_order FOREIGN KEY (order_id)
        REFERENCES orders(id),
    ADD CONSTRAINT fk_foodhub_order_items_menu FOREIGN KEY (menu_item_id)
        REFERENCES menu_items(id) ON DELETE SET NULL;

ALTER TABLE bill_items
    ADD CONSTRAINT fk_foodhub_bill_items_bill FOREIGN KEY (bill_id)
        REFERENCES bills(id),
    ADD CONSTRAINT fk_foodhub_bill_items_order FOREIGN KEY (source_order_id)
        REFERENCES orders(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_foodhub_bill_items_order_item FOREIGN KEY (source_order_item_id)
        REFERENCES order_items(id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_foodhub_bill_items_menu FOREIGN KEY (menu_item_id)
        REFERENCES menu_items(id) ON DELETE SET NULL;

ALTER TABLE bill_tax_lines
    ADD CONSTRAINT fk_foodhub_bill_tax_bill FOREIGN KEY (bill_id)
        REFERENCES bills(id),
    ADD CONSTRAINT fk_foodhub_bill_tax_rule FOREIGN KEY (tax_rule_id)
        REFERENCES tax_rules(id) ON DELETE SET NULL;

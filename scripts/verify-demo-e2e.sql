USE foodhub_db;

SELECT o.id AS order_id, o.table_number, o.status, o.total,
       oi.id AS order_item_id, oi.menu_item_id, oi.name, oi.unit_price,
       oi.quantity, oi.chef_note
FROM orders o
JOIN order_items oi ON oi.order_id = o.id
WHERE o.id = 'c0b839ee-339c-45e5-bd81-0504fcfc1e88'
  AND o.table_number = 9001;

SELECT b.id AS bill_id, b.table_number, b.subtotal, b.tax_total, b.grand_total,
       b.payment_method, b.paid_at, bi.source_order_id, bi.name AS item_name,
       bi.unit_price, bi.quantity, bt.name AS tax_name, bt.percent, bt.amount AS tax_amount
FROM bills b
JOIN bill_items bi ON bi.bill_id = b.id
LEFT JOIN bill_tax_lines bt ON bt.bill_id = b.id
WHERE bi.source_order_id = 'c0b839ee-339c-45e5-bd81-0504fcfc1e88'
ORDER BY b.created_at, bt.id;

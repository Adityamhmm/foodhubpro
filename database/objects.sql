USE foodhub_db;

DROP TRIGGER IF EXISTS bi_order_items_validate;
DROP TRIGGER IF EXISTS ai_order_items_refresh_total;
DROP TRIGGER IF EXISTS au_order_items_refresh_total;
DROP TRIGGER IF EXISTS ad_order_items_refresh_total;
DROP FUNCTION IF EXISTS fn_tax_amount;
DROP PROCEDURE IF EXISTS sp_daily_revenue;

DELIMITER $$

CREATE FUNCTION fn_tax_amount(base_amount DECIMAL(12,2), tax_percent DECIMAL(6,3))
RETURNS DECIMAL(12,2)
DETERMINISTIC
NO SQL
BEGIN
    RETURN ROUND(base_amount * tax_percent / 100, 2);
END$$

CREATE PROCEDURE sp_daily_revenue(IN from_day DATE, IN through_day DATE)
READS SQL DATA
BEGIN
    SELECT DATE(paid_at) AS revenue_day,
           COUNT(*) AS paid_bills,
           SUM(grand_total) AS revenue
    FROM bills
    WHERE paid_at >= from_day
      AND paid_at < DATE_ADD(through_day, INTERVAL 1 DAY)
    GROUP BY DATE(paid_at)
    ORDER BY revenue_day;
END$$

CREATE TRIGGER bi_order_items_validate
BEFORE INSERT ON order_items
FOR EACH ROW
BEGIN
    IF NEW.quantity < 1 OR NEW.quantity > 100 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Order quantity must be between 1 and 100';
    END IF;
    IF NEW.unit_price < 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Order item price cannot be negative';
    END IF;
END$$

CREATE TRIGGER ai_order_items_refresh_total
AFTER INSERT ON order_items
FOR EACH ROW
BEGIN
    UPDATE orders
    SET total = (SELECT COALESCE(SUM(unit_price * quantity), 0) FROM order_items WHERE order_id = NEW.order_id)
    WHERE id = NEW.order_id;
END$$

CREATE TRIGGER au_order_items_refresh_total
AFTER UPDATE ON order_items
FOR EACH ROW
BEGIN
    UPDATE orders
    SET total = (SELECT COALESCE(SUM(unit_price * quantity), 0) FROM order_items WHERE order_id = NEW.order_id)
    WHERE id = NEW.order_id;
    IF OLD.order_id <> NEW.order_id THEN
        UPDATE orders
        SET total = (SELECT COALESCE(SUM(unit_price * quantity), 0) FROM order_items WHERE order_id = OLD.order_id)
        WHERE id = OLD.order_id;
    END IF;
END$$

CREATE TRIGGER ad_order_items_refresh_total
AFTER DELETE ON order_items
FOR EACH ROW
BEGIN
    UPDATE orders
    SET total = (SELECT COALESCE(SUM(unit_price * quantity), 0) FROM order_items WHERE order_id = OLD.order_id)
    WHERE id = OLD.order_id;
END$$

DELIMITER ;

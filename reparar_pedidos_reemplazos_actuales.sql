BEGIN;

-- Repara pedidos que ya tienen reemplazos registrados. Solo toma el último
-- replacement_account_id que continúa delivered; no elimina ni revive cuentas failed.
WITH latest_delivered_replacement AS (
  SELECT DISTINCT ON (ar.order_id)
         ar.order_id,
         ar.user_id,
         ar.replacement_account_id
  FROM account_reports ar
  JOIN platform_accounts pa
    ON pa.id = ar.replacement_account_id
   AND pa.status = 'delivered'
  WHERE ar.replacement_account_id IS NOT NULL
    AND ar.replacement_account_id > 0
  ORDER BY ar.order_id,
           COALESCE(ar.reviewed_at, ar.created_at) DESC,
           ar.id DESC
),
synchronized_accounts AS (
  UPDATE platform_accounts pa
     SET assigned_order_id = current_replacement.order_id,
         assigned_user_id = current_replacement.user_id,
         official_purchase_date = (((o.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/Mexico_City')::date),
         expires_at = ((((o.created_at AT TIME ZONE 'UTC') AT TIME ZONE 'America/Mexico_City')::date) + 28),
         delivered_at = COALESCE(pa.delivered_at, NOW())
    FROM latest_delivered_replacement current_replacement
    JOIN orders o ON o.id = current_replacement.order_id
   WHERE pa.id = current_replacement.replacement_account_id
     AND pa.status = 'delivered'
  RETURNING pa.id, current_replacement.order_id
)
UPDATE orders o
   SET assigned_platform_account_id = repaired.id
  FROM synchronized_accounts repaired
 WHERE o.id = repaired.order_id;

COMMIT;

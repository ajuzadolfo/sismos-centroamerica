-- Invalida suscripciones creadas con claves VAPID anteriores a la rotación de seguridad
DELETE FROM push_subscriptions;

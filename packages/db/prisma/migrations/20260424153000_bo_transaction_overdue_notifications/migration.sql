ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'transaction_overdue';
ALTER TYPE "NotificationCategory" ADD VALUE IF NOT EXISTS 'transaction';
ALTER TYPE "NotificationEntityType" ADD VALUE IF NOT EXISTS 'transaction';

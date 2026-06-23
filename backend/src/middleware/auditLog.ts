/**
 * HIPAA-Compliant Audit Logging Middleware
 * 
 * Logs all access to Protected Health Information (PHI) including:
 * - Who accessed the data (user ID, email, IP)
 * - What was accessed (resource type, resource ID)
 * - When it was accessed (timestamp)
 * - What action was performed (view, create, update, delete)
 * - The outcome (success/failure)
 */

import { Response, NextFunction } from 'express';
import { supabase } from '../lib/supabase.js';
import { AuthenticatedRequest } from './auth.js';

type AuditAction = 
  | 'phi_view' 
  | 'phi_create' 
  | 'phi_update' 
  | 'phi_delete' 
  | 'phi_export'
  | 'phi_sign'
  | 'phi_list'
  | 'auth_login_success'
  | 'auth_login_failed'
  | 'auth_password_change'
  | 'auth_account_locked'
  | 'auth_2fa_enabled'
  | 'auth_2fa_disabled'
  | 'auth_2fa_login_success';

interface AuditLogEntry {
  user_id: string | null;
  action: AuditAction;
  resource_type: string;
  resource_id?: string;
  ip_address?: string;
  user_agent?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Write an audit log entry to the database
 */
export async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
  try {
    await supabase.from('activity_logs').insert({
      user_id: entry.user_id,
      action: entry.action,
      resource_type: entry.resource_type,
      resource_id: entry.resource_id || null,
      ip_address: entry.ip_address || null,
      metadata: {
        ...entry.metadata,
        user_agent: entry.user_agent || null,
        timestamp: new Date().toISOString(),
        hipaa_audit: true,
      },
    });
  } catch (error) {
    // Audit logging should never break the application
    // But we should log the failure
    console.error('[HIPAA AUDIT] Failed to write audit log:', error);
  }
}

/**
 * Middleware that automatically logs PHI access for notes routes
 */
export function auditPHIAccess(resourceType: string) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const originalJson = res.json.bind(res);
    const startTime = Date.now();

    // Determine action from HTTP method
    let action: AuditAction;
    switch (req.method) {
      case 'GET':
        action = req.params.id ? 'phi_view' : 'phi_list';
        break;
      case 'POST':
        if (req.path.includes('/sign')) {
          action = 'phi_sign';
        } else {
          action = 'phi_create';
        }
        break;
      case 'PUT':
      case 'PATCH':
        action = 'phi_update';
        break;
      case 'DELETE':
        action = 'phi_delete';
        break;
      default:
        action = 'phi_view';
    }

    // Override res.json to capture the response and log after success
    res.json = (body: any) => {
      const duration = Date.now() - startTime;

      // Log the access asynchronously (don't block response)
      writeAuditLog({
        user_id: req.user?.id || null,
        action,
        resource_type: resourceType,
        resource_id: req.params.id || body?.id || undefined,
        ip_address: req.ip || req.socket.remoteAddress,
        user_agent: req.headers['user-agent'],
        metadata: {
          method: req.method,
          path: req.originalUrl,
          status_code: res.statusCode,
          duration_ms: duration,
          success: res.statusCode < 400,
        },
      });

      return originalJson(body);
    };

    next();
  };
}

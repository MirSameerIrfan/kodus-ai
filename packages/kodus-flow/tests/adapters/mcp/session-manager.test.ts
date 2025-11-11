import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SessionManager } from '../../../src/adapters/mcp/session-manager.js';

describe('SessionManager', () => {
    let sessionManager: SessionManager;

    beforeEach(() => {
        sessionManager = new SessionManager();
    });

    afterEach(() => {
        sessionManager.destroy();
    });

    it('should create a secure session', () => {
        const tenantId = 'test-tenant';
        const userId = 'test-user';

        const sessionId = sessionManager.createSession(tenantId, userId);

        expect(sessionId).toBeDefined();
        expect(typeof sessionId).toBe('string');
        expect(sessionId.length).toBeGreaterThan(0);
    });

    it('should validate existing session', () => {
        const tenantId = 'test-tenant';
        const userId = 'test-user';

        const sessionId = sessionManager.createSession(tenantId, userId);
        const isValid = sessionManager.validateSession(sessionId, userId);

        expect(isValid).toBe(true);
    });

    it('should reject session validation for different user', () => {
        const tenantId = 'test-tenant';
        const userId = 'test-user';
        const wrongUserId = 'wrong-user';

        const sessionId = sessionManager.createSession(tenantId, userId);
        const isValid = sessionManager.validateSession(sessionId, wrongUserId);

        expect(isValid).toBe(false);
    });

    it('should destroy session', () => {
        const tenantId = 'test-tenant';
        const userId = 'test-user';

        const sessionId = sessionManager.createSession(tenantId, userId);
        sessionManager.destroySession(sessionId, userId);

        const isValid = sessionManager.validateSession(sessionId, userId);
        expect(isValid).toBe(false);
    });

    it('should handle session metadata', () => {
        const tenantId = 'test-tenant';
        const userId = 'test-user';
        const sessionId = sessionManager.createSession(tenantId, userId);

        // Get initial metadata (should be empty)
        let metadata = sessionManager.getSessionMetadata(sessionId, userId);
        expect(metadata).toEqual({});

        // Update metadata
        const newMetadata = { key: 'value', count: 42 };
        sessionManager.updateSessionMetadata(sessionId, newMetadata, userId);

        // Get updated metadata
        metadata = sessionManager.getSessionMetadata(sessionId, userId);
        expect(metadata).toEqual(newMetadata);
    });

    it('should return null for non-existent session metadata', () => {
        const metadata = sessionManager.getSessionMetadata(
            'non-existent',
            'user',
        );
        expect(metadata).toBeNull();
    });
});

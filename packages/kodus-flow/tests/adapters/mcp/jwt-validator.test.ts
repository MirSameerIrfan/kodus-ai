import { describe, it, expect, beforeEach } from 'vitest';
import { JWTValidator } from '../../../src/adapters/mcp/jwt-validator.js';

// Helper to create mock JWT tokens
const createMockJWT = (payload: any): string => {
    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = Buffer.from(JSON.stringify(header)).toString(
        'base64url',
    );
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
        'base64url',
    );
    return `${encodedHeader}.${encodedPayload}.mock_signature`;
};

describe('JWTValidator', () => {
    let validator: JWTValidator;

    beforeEach(() => {
        validator = new JWTValidator();
    });

    describe('validateAudience', () => {
        it('should validate correct audience', () => {
            const tokenWithCorrectAudience =
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiYXVkIjoibWNwOi8vZXhhbXBsZS5jb20vdGVuYW50LTEifQ.signature';
            const result = validator.validateAudience(
                tokenWithCorrectAudience,
                'mcp://example.com/tenant-1',
            );
            expect(result).toBe(true);
        });

        it('should reject incorrect audience', () => {
            const tokenWithWrongAudience =
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiYXVkIjoid3JvbmctYXVkaWVuY2UifQ.signature';
            const result = validator.validateAudience(
                tokenWithWrongAudience,
                'mcp://example.com/tenant-1',
            );
            expect(result).toBe(false);
        });

        it('should handle array audiences', () => {
            const tokenWithArrayAudience =
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiYXVkIjpbIm1jcDovL2V4YW1wbGUuY29tL3RlbmFudC0xIiwib3RoZXItYXVkaWVuY2UiXX0.signature';
            const result = validator.validateAudience(
                tokenWithArrayAudience,
                'mcp://example.com/tenant-1',
            );
            expect(result).toBe(true);
        });
    });

    describe('isExpired', () => {
        it('should detect expired token', () => {
            const expiredToken =
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE1MTYyMzkwMjJ9.signature'; // exp: 2018
            const result = validator.isExpired(expiredToken);
            expect(result).toBe(true);
        });

        it('should detect valid token', () => {
            const futureExp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
            const validPayload = { exp: futureExp };
            const validToken = createMockJWT(validPayload);
            const result = validator.isExpired(validToken);
            expect(result).toBe(false);
        });

        it('should handle token without exp claim', () => {
            const payloadWithoutExp = { sub: '123' };
            const tokenWithoutExp = createMockJWT(payloadWithoutExp);
            const result = validator.isExpired(tokenWithoutExp);
            expect(result).toBe(false); // Not expired, just doesn't have exp
        });
    });

    describe('getExpirationTime', () => {
        it('should return expiration time', () => {
            const expTime = 1735689600; // Future timestamp
            const payload = { exp: expTime };
            const token = createMockJWT(payload);
            const result = validator.getExpirationTime(token);
            expect(result).toBe(expTime);
        });

        it('should return null for invalid token', () => {
            const result = validator.getExpirationTime('invalid-token');
            expect(result).toBeNull();
        });
    });

    describe('OAuth Provider Factory', () => {
        it('should create validator for OAuth provider', () => {
            const oauthValidator = JWTValidator.forOAuthProvider(
                'https://auth.example.com',
                'mcp://server.com/tenant-1',
            );

            expect(oauthValidator).toBeInstanceOf(JWTValidator);
        });
    });

    describe('Service Tokens Factory', () => {
        it('should create validator for service tokens', () => {
            const serviceValidator = JWTValidator.forServiceTokens(
                'mcp://server.com/tenant-1',
                'https://issuer.example.com',
            );

            expect(serviceValidator).toBeInstanceOf(JWTValidator);
        });
    });
});

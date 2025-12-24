import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ObservabilitySystem } from '../../src/observability/observability.js';
import * as otel from '@opentelemetry/api';

// Mocking OTel API
vi.mock('@opentelemetry/api', async () => {
    const actual = await vi.importActual('@opentelemetry/api');
    return {
        ...actual,
        trace: {
            getTracer: vi.fn(),
            getActiveSpan: vi.fn(),
        },
        context: {
            active: vi.fn(() => ({ getValue: vi.fn() })),
        },
    };
});

describe('OTel Bridge Integration', () => {
    let observability: ObservabilitySystem;
    let mockTracer: any;
    let mockSpan: any;

    beforeEach(() => {
        // Reset mocks
        vi.clearAllMocks();

        // Setup OTel mocks
        mockSpan = {
            setStatus: vi.fn(),
            end: vi.fn(),
            recordException: vi.fn(),
            setAttribute: vi.fn(),
        };

        mockTracer = {
            startSpan: vi.fn().mockReturnValue(mockSpan),
        };

        (otel.trace.getTracer as any).mockReturnValue(mockTracer);

        // Initialize ObservabilitySystem with OTLP enabled
        observability = new ObservabilitySystem({
            enabled: true,
            otlp: {
                enabled: true,
            },
            // Disable MongoDB to focus on OTel
            mongodb: undefined,
        });
    });

    afterEach(async () => {
        if (observability) {
            await observability.shutdown();
        }
    });

    it('should export traces to OTel when a trace is created', async () => {
        // Act: Create a trace via ObservabilitySystem
        await observability.trace('test-operation', async () => {
            // simulating work
            await new Promise((resolve) => setTimeout(resolve, 10));
        });

        // Force flush to ensure async processors run
        await observability.flush();

        // Wait for async processing (fire-and-forget in withSpan)
        await new Promise((resolve) => setTimeout(resolve, 50));

        // Assert: Check if OTel tracer was called
        expect(otel.trace.getTracer).toHaveBeenCalledWith(
            'kodus-flow',
            undefined,
        );

        // Check if startSpan was called with correct name
        expect(mockTracer.startSpan).toHaveBeenCalledWith(
            'test-operation',
            expect.objectContaining({
                kind: 0, // Internal
                startTime: expect.any(Number),
                attributes: expect.objectContaining({
                    // Basic attributes should be present
                }),
            }),
        );

        // Check if span was ended
        expect(mockSpan.end).toHaveBeenCalled();
        expect(mockSpan.setStatus).toHaveBeenCalledWith({ code: 1 }); // OK status
    });

    it('should propagate errors to OTel spans', async () => {
        // Act: Create a failing trace
        try {
            await observability.trace('failing-operation', async () => {
                throw new Error('Test Error');
            });
        } catch {}

        await observability.flush();
        await new Promise((resolve) => setTimeout(resolve, 50));

        // Assert
        expect(mockTracer.startSpan).toHaveBeenCalledWith(
            'failing-operation',
            expect.any(Object),
        );

        // Should set status to Error (code 2 in OTel)
        expect(mockSpan.setStatus).toHaveBeenCalledWith({
            code: 2,
            message: 'Test Error',
        });

        expect(mockSpan.end).toHaveBeenCalled();
    });
});

export interface CockpitMetricsVisibility {
    summary: {
        deployFrequency: boolean;
        prCycleTime: boolean;
        kodySuggestions: boolean;
        bugRatio: boolean;
        prSize: boolean;
    };
    details: {
        leadTimeBreakdown: boolean;
        prCycleTime: boolean;
        prsOpenedVsClosed: boolean;
        prsMergedByDeveloper: boolean;
        teamActivity: boolean;
    };
}

export const DEFAULT_COCKPIT_METRICS_VISIBILITY: CockpitMetricsVisibility = {
    summary: {
        deployFrequency: true,
        prCycleTime: true,
        kodySuggestions: true,
        bugRatio: true,
        prSize: true,
    },
    details: {
        leadTimeBreakdown: true,
        prCycleTime: true,
        prsOpenedVsClosed: true,
        prsMergedByDeveloper: true,
        teamActivity: true,
    },
};


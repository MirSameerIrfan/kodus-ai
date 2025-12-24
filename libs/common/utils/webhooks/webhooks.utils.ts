export const extractRepoFullName = (pullRequest: any): string => {
    return (
        pullRequest?.repository?.full_name ||
        pullRequest?.repository?.path_with_namespace ||
        pullRequest?.base?.repo?.full_name ||
        pullRequest?.target?.path_with_namespace ||
        pullRequest?.destination?.repository?.full_name ||
        null
    );
};

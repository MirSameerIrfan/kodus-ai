const path = require('path');
const nodeExternals = require('webpack-node-externals');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');
const { RunScriptWebpackPlugin } = require('run-script-webpack-plugin');

module.exports = function (options, webpack) {
    const debugPort = process.env.DEBUG_PORT || 9229;
    const debugBreak = process.env.DEBUG_BREAK === 'true';
    const inspectArg = debugBreak ? '--inspect-brk' : '--inspect';

    return {
        ...options,
        cache: {
            type: 'filesystem',
            cacheDirectory: path.resolve(__dirname, '.build_cache'),
        },
        stats: 'errors-warnings',
        devtool: 'source-map',
        externals: [
            nodeExternals({
                allowlist: [],
            }),
        ],
        output: {
            ...options.output,
            devtoolModuleFilenameTemplate: (info) =>
                info.absoluteResourcePath.replace(/\\\\/g, '/'),
            devtoolFallbackModuleFilenameTemplate: (info) =>
                info.absoluteResourcePath.replace(/\\\\/g, '/'),
        },
        resolve: {
            plugins: [
                new TsconfigPathsPlugin({ configFile: './tsconfig.json' }),
            ],
            extensions: ['.ts', '.tsx', '.js', '.json'],
        },
        plugins: [
            ...options.plugins,
            new webpack.HotModuleReplacementPlugin(),
            new webpack.WatchIgnorePlugin({
                paths: [/\.js$/, /\.d\.ts$/],
            }),
            new RunScriptWebpackPlugin({
                name: options.output.filename,
                autoRestart: false,
                nodeArgs: [`${inspectArg}=0.0.0.0:${debugPort}`],
            }),
        ],
        watchOptions: {
            aggregateTimeout: 300,
            poll: 1000,
            ignored: /node_modules/,
        },
        module: {
            rules: [
                {
                    test: /\.tsx?$/,
                    use: [
                        {
                            loader: 'ts-loader',
                            options: {
                                transpileOnly: true,
                            },
                        },
                    ],
                    exclude: /node_modules/,
                },
            ],
        },
    };
};

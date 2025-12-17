const path = require('path');
const nodeExternals = require('webpack-node-externals');

module.exports = function (options, webpack) {
    return {
        ...options,
        externals: [
            nodeExternals({
                allowlist: ['webpack/hot/poll?100'],
            }),
        ],
        module: {
            rules: [
                {
                    test: /\.ts$/,
                    use: {
                        loader: 'swc-loader',
                        options: {
                            jsc: {
                                parser: {
                                    syntax: 'typescript',
                                    decorators: true,
                                    dynamicImport: true,
                                },
                                transform: {
                                    legacyDecorator: true,
                                    decoratorMetadata: true,
                                },
                                baseUrl: path.resolve(__dirname),
                                paths: {
                                    '@libs/*': ['libs/*'],
                                    '@apps/*': ['apps/*'],
                                },
                            },
                        },
                    },
                    exclude: /node_modules/,
                },
            ],
        },
    };
};

const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
    resolver: {
        extraNodeModules: {
            'memoize-one': require.resolve('memoize-one'),
            'react-refresh': require.resolve('react-refresh'),
        },
    },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);

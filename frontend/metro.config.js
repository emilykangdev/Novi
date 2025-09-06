const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add any custom configuration here
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

module.exports = config;

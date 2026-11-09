const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('glb');

// expo-three imports example loaders without extensions; Three exports require .js.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolvedName = /^three\/examples\/jsm\/.*(?<!\.js)$/.test(moduleName)
    ? `${moduleName}.js`
    : moduleName;
  return context.resolveRequest(context, resolvedName, platform);
};

module.exports = config;

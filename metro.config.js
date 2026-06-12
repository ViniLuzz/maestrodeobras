const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Inline requires: módulos são carregados sob demanda (lazy) em vez de
// avaliados todos no boot. Acelera bastante o tempo de primeira renderização.
config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true,
  },
});

module.exports = config;

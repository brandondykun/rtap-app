module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
    plugins: [
      // WatermelonDB models use legacy decorators; class fields must not shadow decorated getters.
      ['@babel/plugin-proposal-decorators', { legacy: true }],
      ['@babel/plugin-transform-class-properties', { loose: true }],
      // Must match class-properties' loose mode, or RN sources with #private methods fail to compile.
      ['@babel/plugin-transform-private-methods', { loose: true }],
      ['@babel/plugin-transform-private-property-in-object', { loose: true }],
    ],
  };
};

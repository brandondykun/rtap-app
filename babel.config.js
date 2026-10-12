const path = require('path');

const NODE_MODULES = `${path.sep}node_modules${path.sep}`;

module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { jsxImportSource: 'nativewind' }], 'nativewind/babel'],
    overrides: [
      {
        // App code only: running these on node_modules turns React Native's Flow-only field
        // declarations (e.g. `+NONE: 0` in Event.js) into real assignments that crash at runtime.
        test: (filename) => Boolean(filename) && !filename.includes(NODE_MODULES),
        plugins: [
          // WatermelonDB models use legacy decorators; class fields must not shadow decorated getters.
          ['@babel/plugin-proposal-decorators', { legacy: true }],
          ['@babel/plugin-transform-class-properties', { loose: true }],
          ['@babel/plugin-transform-private-methods', { loose: true }],
          ['@babel/plugin-transform-private-property-in-object', { loose: true }],
        ],
      },
    ],
  };
};

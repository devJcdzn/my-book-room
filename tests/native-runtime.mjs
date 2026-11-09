// Node tests exercise data flows, not native rendering. The theme only needs these constants.
import Module from 'node:module';

const load = Module._load;
Module._load = function (specifier, ...args) {
  if (specifier === 'react-native') {
    return { Platform: { OS: 'test', select: (values) => values.default }, StyleSheet: { hairlineWidth: 1 } };
  }
  return load.call(this, specifier, ...args);
};

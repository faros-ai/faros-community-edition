// Workaround for https://github.com/microsoft/TypeScript/issues/43329

export default new Function('moduleName', 'return import(moduleName)');

try {
    console.log('Resolving from root:');
    console.log(require.resolve('memoize-one'));
    console.log('Success!');
} catch (e) {
    console.error('Failed to resolve from root:', e.message);
}

try {
    console.log('Resolving from inside react-native (simulated):');
    const path = require('path');
    const rnPath = path.join(__dirname, 'node_modules/react-native/Libraries/Components/ScrollView');
    // This simulation is just checking if we can resolve it given the module paths, 
    // but Module.createRequire is better if available (Node 12+)
    const { createRequire } = require('module');
    const rnRequire = createRequire(path.join(rnPath, 'ScrollView.js'));
    console.log(rnRequire.resolve('memoize-one'));
    console.log('Success from RN!');
} catch (e) {
    console.error('Failed to resolve from RN:', e.message);
}

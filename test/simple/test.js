var osg = require('./index.js');

var job = osg.submit({
    input: 'job.js',
    run: 'node job.js',
    output: 'ouput.txt',
});
job.progress(function() {
    console.log("job making progress");
}).success(function() {
    console.log("job fisnished successfully");
}).failed(function() {
    console.log("job failed");
}).evicted(function() {
    console.log("job evicted");
});

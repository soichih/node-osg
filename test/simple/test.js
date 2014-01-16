var osg = require('../../index.js');

var job = osg.submit({
    input: ['job.js'],
    run: 'node job.js',
    stdout: 'stdout.txt',
    stderr: 'stderr.txt',
});
job.submit(function(p) {
    console.log("job submitted");
    console.dir(p);
}).progress(function(p) {
    console.log("job making progress");
    console.dir(p);
}).success(function(p) {
    console.log("job fisnished successfully");
    console.dir(p);
}).failed(function(p) {
    console.log("job failed");
    console.dir(p);
}).evicted(function() {
    console.log("job evicted");
    console.dir(p);
});

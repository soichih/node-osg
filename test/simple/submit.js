var osg = require('../../index.js');
var fs = require('fs');

function submit() {
    var job = osg.submit({
        input: ['job.js'],
        run: './node job.js',
        //stdout: 'stdout.txt',
        //stderr: 'stderr.txt',
    });
    job.submit(function(event) {
        console.log("job submitted");
        console.dir(event);
    }).progress(function(event) {
        console.log("job making progress");
        console.dir(event);
    }).success(function(event) {
        console.log("job fisnished successfully");
        console.dir(event);
        fs.readFile(job.options.stdout, 'utf8', function (err,data) {
            console.log(data);
        }); 

        //resubmit
        //submit();

    }).failed(function(event) {
        console.log("job failed");
        console.dir(event);
        fs.readFile(job.options.stdout, 'utf8', function (err,data) {
            console.log(data);
        }); 
        fs.readFile(job.options.stderr, 'utf8', function (err,data) {
            console.log(data);
        }); 
    }).evicted(function() {
        console.log("job evicted");
        console.dir(event);
    });
};

submit();

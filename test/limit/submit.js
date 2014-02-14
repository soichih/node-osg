var osg = require('../../index.js');
var fs = require('fs');

osg.submit({
    send: ['job.js'],  
    //receive: ['output.txt'], 
    run: 'node job.js', //command to run and arguments

    timeout: 25, //kill in 15 seconds
    
    env: {name: "soichi"} //used by wn
}, {
    submit: function(job, event) {
        console.log("job submitted");
        console.dir(event);
    },
    execute: function(job, event) {
        console.log("job executing");
        console.dir(event);
    },
    progress: function(job, event) {
        console.log("progress");
        console.dir(event);
    },
    exception: function(job, event) {
        console.log("exception");
        console.dir(event);
    },
    held: function(job, event) {
        console.log("job held");
        //console.dir(job);
        console.dir(event);
        fs.readFile(job.options.output, 'utf8', function (err,data) {
            console.log(data);
        }); 
        fs.readFile(job.options.error, 'utf8', function (err,data) {
            console.log(data);
        }); 
    },
    evicted: function(job, event) {
        console.log("job evicted");
        console.dir(event);
    },
    terminated: function(job, event) {
        console.log("job terminated");
        console.dir(event);
        //console.dir(job);
        fs.readFile(job.options.output, 'utf8', function (err,data) {
            console.log(data);
        }); 
        fs.readFile(job.options.error, 'utf8', function (err,data) {
            console.log(data);
        }); 
        job.log.unwatch();
    },
});


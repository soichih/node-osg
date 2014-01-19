var osg = require('../../index.js');
var fs = require('fs');

osg.init({
    //needed to run jobs on osg-xsede
    condor: {
        "+ProjectName": "CSIU"
    }
}, function() {
    submit();
});

function submit() {
    osg.submit({
        send: ['job.js'],  
        //receive: ['output.txt'], 
        run: 'node job.js', //command to run and arguments
        timeout: 15, //kill in 15 seconds
        
        //any custom options that I'd like to pass to job
        //env: {name: "soichi"}
    }, {
        submit: function(job, event) {
            console.log("job submitted");
            console.dir(event);
        },
        execute: function(job, event) {
            console.log("job executing");
            console.dir(event);
        },
        image_size: function(job, event) {
            console.log("image_size");
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
            console.dir(job);
            console.dir(event);
            fs.readFile(job.options.output, 'utf8', function (err,data) {
                console.log(data);
            }); 
            fs.readFile(job.options.error, 'utf8', function (err,data) {
                console.log(data);
            }); 
        },
    });
};


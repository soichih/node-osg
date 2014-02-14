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
    console.log("submitting");
    osg.submit({
        send: ['job.js', 'btsync'],  
        //receive: ['output.txt'], //don't set this if you want *all* files (not directory) created in the wn/cwd.
        run: 'node job.js', //command to run and arguments
        
        //env parameters to pass to my job
        env: {name: "soichi"},
        
        timeout: 60*10 //kill job in 10 minutes (should take less than seconds to run)
    }, {
        exception: function(job, event) {
            console.log("exception");
            console.dir(event);
        },
        held: function(job, event) {
            console.log("job held");
            console.dir(event);
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
            job.log.unwatch();
        },
    });
};

